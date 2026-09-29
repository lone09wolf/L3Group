import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const attempts = new Map();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 12_000) throw new Error('Request too large');
  }
  return JSON.parse(body || '{}');
}

async function sendEnquiry(request, response) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < 10 * 60 * 1000);
  if (recent.length >= 5) return json(response, 429, { error: 'Please wait before trying again.' });
  recent.push(now);
  attempts.set(key, recent);

  let data;
  try { data = await readJson(request); }
  catch { return json(response, 400, { error: 'The enquiry could not be read.' }); }

  if (data.website) return json(response, 200, { ok: true });
  const name = String(data.name || '').trim().slice(0, 100);
  const email = String(data.email || '').trim().slice(0, 254);
  const location = String(data.location || '').trim().slice(0, 120);
  const service = String(data.service || '').trim().slice(0, 100);
  const message = String(data.message || '').trim().slice(0, 1500);
  if (!name || !location || !service || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(response, 400, { error: 'Please complete every field with valid details.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.L3_FROM_EMAIL;
  if (!apiKey || !from) return json(response, 503, { error: 'Online delivery is not configured.' });

  const delivery = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `L3 Group Website <${from}>`,
      to: ['inquiry@i3group.co.za'],
      reply_to: email,
      subject: `Website enquiry: ${service}`,
      html: `<h2>New L3 Group enquiry</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Location:</strong> ${escapeHtml(location)}</p><p><strong>Service:</strong> ${escapeHtml(service)}</p><p><strong>Project:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    }),
  });
  if (!delivery.ok) return json(response, 502, { error: 'The delivery service did not accept the enquiry.' });
  return json(response, 200, { ok: true });
}

async function serveFile(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error('Not a file');
    const cache = /\.(?:jpg|png|svg|webp)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

http.createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/enquiry') return await sendEnquiry(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') return response.writeHead(405).end();
    return await serveFile(request, response);
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: 'Unexpected server error.' });
  }
}).listen(port, host, () => console.log(`L3 Group website running on ${host}:${port}`));
