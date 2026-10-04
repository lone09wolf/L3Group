import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
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
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

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
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const segments = requested.split(/[\\/]/);
  if (segments.some(segment => segment.startsWith('.')) || segments.includes('tests') ||
      !Object.hasOwn(types, path.extname(requested).toLowerCase())) {
    return response.writeHead(404).end('Not found');
  }
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error('Not a file');
    const cache = /\.(?:jpg|png|svg|webp|mp4)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
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
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
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
