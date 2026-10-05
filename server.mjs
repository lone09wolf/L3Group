import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleEnquiry, createLocalRateLimiter, jsonResponse } from './enquiry.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
const host = process.env.HOST || '0.0.0.0';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const redirects = new Map((await readFile(path.join(root, '_redirects'), 'utf8'))
  .split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'))
  .map(line => { const [from, to, status] = line.trim().split(/\s+/); return [from, { to, status: Number(status) }]; }));

async function notFound(request, response) {
  const page = await readFile(path.join(root, '404.html'));
  response.writeHead(404, { 'Content-Type': types['.html'], 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex' });
  response.end(request.method === 'HEAD' ? undefined : page);
}

async function respond(response, result) {
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(await result.text());
}

async function apiRequest(request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  let body;
  if (request.method === 'POST') {
    const chunks = [];
    let length = 0;
    // Bound the local HTTP adapter too, before creating a Fetch API request.
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 12_000) throw new RangeError('Request too large');
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }
  return new Request(new URL(request.url, `http://${request.headers.host || 'localhost'}`), {
    method: request.method, headers, ...(body ? { body } : {}),
  });
}

async function serveFile(request, response) {
  const url = new URL(request.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return notFound(request, response); }
  const redirect = redirects.get(pathname);
  if (redirect) return response.writeHead(redirect.status, { Location: redirect.to + url.search }).end();
  if (pathname !== '/' && pathname.endsWith('/')) {
    const clean = pathname.replace(/\/+$/, '');
    try {
      if ((await stat(path.join(root, `${clean}.html`))).isFile()) {
        return response.writeHead(301, { Location: clean + url.search }).end();
      }
    } catch { /* Missing paths must remain genuine 404s. */ }
  }
  const requested = pathname === '/' ? '/index.html' : path.extname(pathname) ? pathname : `${pathname}.html`;
  const segments = requested.split(/[\\/]/);
  if (segments.some(segment => segment.startsWith('.')) || segments.includes('tests') ||
      !Object.hasOwn(types, path.extname(requested).toLowerCase())) {
    return notFound(request, response);
  }
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error('Not a file');
    const cache = /\.(?:jpg|png|svg|webp|avif|mp4|woff2)$/.test(file) ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache';
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache, 'Content-Length': details.size };
    const isVideo = path.extname(file) === '.mp4';
    if (isVideo) headers['Accept-Ranges'] = 'bytes';
    if (isVideo && request.headers.range && request.method === 'GET') {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      const start = range?.[1] ? Number(range[1]) : Math.max(0, details.size - Number(range?.[2]));
      const end = range?.[1] && range[2] ? Math.min(Number(range[2]), details.size - 1) : details.size - 1;
      if (!range || (!range[1] && !range[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= details.size) {
        return response.writeHead(416, { 'Content-Range': `bytes */${details.size}` }).end();
      }
      response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${details.size}` });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, headers);
    if (request.method === 'HEAD') return response.end();
    createReadStream(file).pipe(response);
  } catch {
    return notFound(request, response);
  }
}

export function createWebsiteServer({ env = process.env, fetcher = fetch } = {}) {
  const limit = createLocalRateLimiter();
  return http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const clientIp = request.socket.remoteAddress;
      const result = await handleEnquiry(await apiRequest(request), env, {
        clientIp, rateLimit: () => limit(clientIp), fetcher,
      });
      return await respond(response, result);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return response.writeHead(405).end();
    return await serveFile(request, response);
  } catch (error) {
    return await respond(response, jsonResponse(error instanceof RangeError ? 413 : 500, {
      error: error instanceof RangeError ? 'The enquiry is too large.' : 'Unexpected server error.',
    }));
  }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createWebsiteServer().listen(port, host, () => console.log(`L3 Group website running on ${host}:${port}`));
}
