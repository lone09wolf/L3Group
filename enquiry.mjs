const SERVICES = new Set([
  'Construction', 'Renovations', 'Civil / Building Works', 'Design / Planning',
  'Construction Consulting', 'Project Coordination', 'Other / Not sure',
]);
const BODY_LIMIT = 12_000;
const EMAIL = /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/;
const DEFAULT_RECIPIENT = 'INQUIRY@L3GROUP.CO.ZA';
const UNAVAILABLE = 'Online enquiries are temporarily unavailable. Please email INQUIRY@L3GROUP.CO.ZA or call +27 84 498 3650.';

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function settings(env) {
  const from = (env.L3_FROM_EMAIL || '').trim();
  const to = (env.L3_TO_EMAIL || DEFAULT_RECIPIENT).trim();
  const siteKey = (env.TURNSTILE_SITE_KEY || '').trim();
  const secret = (env.TURNSTILE_SECRET_KEY || '').trim();
  // Never activate Cloudflare's public, always-pass testing keys in a deployment.
  const realKeys = siteKey && secret && !/^[123]x0{10}/.test(siteKey) && !/^[123]x0{10}/.test(secret);
  return { from, to, siteKey, secret, ready: Boolean(realKeys && env.RESEND_API_KEY && EMAIL.test(from) && EMAIL.test(to)) };
}

async function readJson(request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT)) {
    throw new RangeError('Request too large');
  }
  if (!request.body) throw new SyntaxError('Missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > BODY_LIMIT) {
        await reader.cancel();
        throw new RangeError('Request too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function validateFields(data) {
  const limits = { name: 100, email: 254, location: 120, service: 100, message: 1500 };
  const fields = {};
  for (const [name, limit] of Object.entries(limits)) {
    if (typeof data[name] !== 'string' || data[name].length > limit) return null;
    const value = data[name].trim();
    if (!value || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return null;
    if (name !== 'message' && /[\r\n]/.test(value)) return null;
    fields[name] = value;
  }
  return EMAIL.test(fields.email) && SERVICES.has(fields.service) ? fields : null;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

async function fetchJson(fetcher, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error('Upstream rejected request');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleEnquiry(request, env, { clientIp, rateLimit, fetcher = fetch, timeoutMs = 10_000 } = {}) {
  const url = new URL(request.url);
  const config = settings(env);
  if (url.pathname === '/api/enquiry/config') {
    if (request.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
    const ready = config.ready && typeof rateLimit === 'function';
    return jsonResponse(ready ? 200 : 503, ready ? { siteKey: config.siteKey } : { error: UNAVAILABLE });
  }
  if (url.pathname !== '/api/enquiry') return jsonResponse(404, { error: 'Not found.' });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return jsonResponse(403, { error: 'Please submit your enquiry from the L3 Group website.' });
  }
  if (!config.ready || typeof rateLimit !== 'function') return jsonResponse(503, { error: UNAVAILABLE });
  try {
    if (!await rateLimit()) {
      return jsonResponse(429, { error: 'Too many attempts. Please wait one minute before trying again.' }, { 'Retry-After': '60' });
    }
  } catch {
    return jsonResponse(503, { error: UNAVAILABLE });
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return jsonResponse(415, { error: 'Please submit the online enquiry form.' });
  }
  let data;
  try { data = await readJson(request); }
  catch (error) {
    return jsonResponse(error instanceof RangeError ? 413 : 400, { error: 'The enquiry could not be read. Please check your details.' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return jsonResponse(400, { error: 'Invalid enquiry.' });
  if (typeof data.website === 'string' && data.website.trim()) return jsonResponse(200, { ok: true });
  const fields = validateFields(data);
  if (!fields) return jsonResponse(400, { error: 'Please complete every field with valid details.' });
  const token = data['cf-turnstile-response'];
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return jsonResponse(400, { error: 'Please complete the security check before sending.' });
  }
  let verified;
  try {
    verified = await fetchJson(fetcher, 'https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: config.secret, response: token, ...(clientIp ? { remoteip: clientIp } : {}) }),
    }, timeoutMs);
  } catch {
    return jsonResponse(503, { error: 'The security check is temporarily unavailable. Please try again shortly.' });
  }
  if (verified?.success !== true || verified.hostname !== url.hostname || verified.action !== 'enquiry') {
    return jsonResponse(403, { error: 'The security check expired or could not be verified. Please complete it again.' });
  }
  const { name, email, location, service, message } = fields;
  const mail = {
    from: `L3 Group Website <${config.from}>`, to: [config.to], reply_to: email,
    subject: `Website enquiry: ${service}`,
    text: `New L3 Group enquiry\n\nName: ${name}\nEmail: ${email}\nLocation: ${location}\nService: ${service}\n\nProject:\n${message}`,
    html: `<h2>New L3 Group enquiry</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Location:</strong> ${escapeHtml(location)}</p><p><strong>Service:</strong> ${escapeHtml(service)}</p><p><strong>Project:</strong></p><p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p>`,
  };
  try {
    // Identical submissions share a provider key, including when a response is lost.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(mail)));
    const key = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const delivery = await fetchJson(fetcher, 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `l3-enquiry-${key}` },
      body: JSON.stringify(mail),
    }, timeoutMs);
    if (typeof delivery?.id !== 'string' || !delivery.id) throw new Error('Missing delivery reference');
    return jsonResponse(200, { ok: true });
  } catch {
    return jsonResponse(502, { error: 'We could not confirm your email was sent. Please try again or email INQUIRY@L3GROUP.CO.ZA directly.' });
  }
}

export function createLocalRateLimiter({ limit = 5, periodMs = 60_000, maxKeys = 10_000, now = Date.now } = {}) {
  const attempts = new Map();
  return async key => {
    const time = now();
    for (const [address, entry] of attempts) {
      if (entry.expires <= time) attempts.delete(address);
    }
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= maxKeys) return false;
      entry = { count: 0, expires: time + periodMs };
      attempts.set(key, entry);
    }
    return ++entry.count <= limit;
  };
}
