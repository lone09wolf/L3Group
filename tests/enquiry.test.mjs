import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { handleEnquiry, createLocalRateLimiter } from '../enquiry.mjs';
import { createWebsiteServer } from '../server.mjs';
import worker from '../worker.mjs';

const env = {
  RESEND_API_KEY: 'test-email-secret', L3_FROM_EMAIL: 'website@forms.example.com',
  L3_TO_EMAIL: 'INQUIRY@L3GROUP.CO.ZA',
  TURNSTILE_SITE_KEY: 'test-public-site-key', TURNSTILE_SECRET_KEY: 'test-captcha-secret',
};
const enquiry = {
  name: 'Test Visitor', email: 'visitor@example.com', location: 'Cape Town',
  service: 'Construction', message: 'A test project enquiry', website: '',
  'cf-turnstile-response': 'test-token',
};
const verification = { success: true, hostname: 'l3group.co.za', action: 'enquiry' };
const url = 'https://l3group.co.za/api/enquiry';

function request(data = enquiry, headers = {}, method = 'POST') {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(data) } : {}) });
}

function harness({ verified = verification, deliveryStatus = 200, delivery = { id: 'mail-123' }, config = env, rateLimit = async () => true } = {}) {
  const calls = [];
  const fetcher = async (endpoint, options) => {
    calls.push({ endpoint, options, data: JSON.parse(options.body) });
    return endpoint.includes('siteverify') ? Response.json(verified) : Response.json(delivery, { status: deliveryStatus });
  };
  return { calls, send: incoming => handleEnquiry(incoming, config, { clientIp: '192.0.2.1', rateLimit, fetcher }) };
}

test('verifies CAPTCHA before sending only to the configured mailbox', async () => {
  const { send, calls } = harness();
  const response = await send(request({ ...enquiry, to: 'attacker@example.com', name: '<b>Visitor</b>', message: '<script>bad()</script>\nNext line' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].endpoint, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.deepEqual(calls[0].data, { secret: env.TURNSTILE_SECRET_KEY, response: 'test-token', remoteip: '192.0.2.1' });
  assert.equal(calls[1].endpoint, 'https://api.resend.com/emails');
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
  assert.deepEqual(calls[1].data.to, ['INQUIRY@L3GROUP.CO.ZA']);
  assert.equal(calls[1].data.from, 'L3 Group Website <website@forms.example.com>');
  assert.equal(calls[1].data.reply_to, enquiry.email);
  assert.match(calls[1].data.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;<br>Next line/);
  assert.doesNotMatch(calls[1].data.html, /<script>/);
  assert.match(calls[1].data.text, /Next line/);
});

test('default mailbox uses the human-confirmed INQUIRY spelling', async () => {
  const config = { ...env };
  delete config.L3_TO_EMAIL;
  const { send, calls } = harness({ config });
  await send(request());
  assert.deepEqual(calls[1].data.to, ['INQUIRY@L3GROUP.CO.ZA']);
});

test('server environment can configure the destination; submitted recipient cannot', async () => {
  const { send, calls } = harness({ config: { ...env, L3_TO_EMAIL: 'approved@example.com' } });
  await send(request({ ...enquiry, L3_TO_EMAIL: 'attacker@example.com' }));
  assert.deepEqual(calls[1].data.to, ['approved@example.com']);
});

test('invalid and overlong fields never reach verification or email providers', async () => {
  for (const data of [null, [], 'invalid', { ...enquiry, email: 'invalid' }, { ...enquiry, email: 'visitor@example.com\r\nBcc:attack@example.com' },
    { ...enquiry, name: {} }, { ...enquiry, location: '' }, { ...enquiry, name: 'x'.repeat(101) },
    { ...enquiry, message: 'x'.repeat(1501) }, { ...enquiry, service: 'Unapproved service' }]) {
    const { send, calls } = harness();
    assert.equal((await send(request(data))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('missing, blank, and oversized CAPTCHA tokens never send mail', async () => {
  for (const token of [undefined, '', ' ', {}, 'x'.repeat(2049)]) {
    const { send, calls } = harness();
    assert.equal((await send(request({ ...enquiry, 'cf-turnstile-response': token }))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('failed, expired, duplicate, wrong-host, and wrong-action tokens never send mail', async () => {
  for (const verified of [{ success: false }, { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...verification, hostname: 'attacker.example' }, { ...verification, action: 'another-form' }, {}, null]) {
    const { send, calls } = harness({ verified });
    assert.equal((await send(request())).status, 403);
    assert.equal(calls.length, 1);
  }
});

test('honeypot submissions silently discard mail', async () => {
  const { send, calls } = harness();
  assert.equal((await send(request({ ...enquiry, website: 'https://spam.example' }))).status, 200);
  assert.equal(calls.length, 0);
});

test('fails closed if any configuration or the rate limiter is missing', async () => {
  for (const key of ['RESEND_API_KEY', 'L3_FROM_EMAIL', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    const { send, calls } = harness({ config: { ...env, [key]: '' } });
    assert.equal((await send(request())).status, 503);
    assert.equal(calls.length, 0);
  }
  assert.equal((await handleEnquiry(request(), env)).status, 503);
  assert.equal((await harness({ config: { ...env, L3_TO_EMAIL: 'invalid' } }).send(request())).status, 503);
});

test('rejects public always-pass Turnstile testing credentials', async () => {
  for (const key of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    const { send, calls } = harness({ config: { ...env, [key]: '1x00000000000000000000AA' } });
    assert.equal((await send(request())).status, 503);
    assert.equal(calls.length, 0);
  }
});

test('public config exposes only the site key, never secrets or mailbox settings', async () => {
  const { send } = harness();
  const response = await send(new Request(`${url}/config`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { siteKey: env.TURNSTILE_SITE_KEY });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await harness({ config: {} }).send(new Request(`${url}/config`))).status, 503);
});

test('rejects cross-origin posts, wrong methods, and unsupported content types', async () => {
  for (const [headers, method, expected] of [
    [{ Origin: 'https://attacker.example' }, 'POST', 403],
    [{ 'Sec-Fetch-Site': 'cross-site' }, 'POST', 403],
    [{ 'Content-Type': 'text/plain' }, 'POST', 415],
    [{}, 'GET', 405],
  ]) {
    const { send, calls } = harness();
    assert.equal((await send(request(enquiry, headers, method))).status, expected);
    assert.equal(calls.length, 0);
  }
  assert.equal((await harness().send(request(enquiry, { Origin: 'https://l3group.co.za' }))).status, 200);
});

test('rejects malformed JSON and oversized bodies, including streamed UTF-8', async () => {
  const { send, calls } = harness();
  for (const [body, status] of [['not json', 400], ['x'.repeat(12_001), 413]]) {
    assert.equal((await send(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))).status, status);
  }
  const bytes = new TextEncoder().encode('"' + '\u00e9'.repeat(6100) + '"');
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  assert.equal((await send(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' }))).status, 413);
  assert.equal(calls.length, 0);
});

test('rate limiting stops verification costs and includes Retry-After', async () => {
  const { send, calls } = harness({ rateLimit: async () => false });
  const response = await send(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(calls.length, 0);
  assert.equal((await harness({ rateLimit: async () => { throw new Error('unavailable'); } }).send(request())).status, 503);
});

test('local rate limiter bounds address storage and expires old entries', async () => {
  let time = 100;
  const limit = createLocalRateLimiter({ limit: 2, maxKeys: 2, periodMs: 60, now: () => time });
  assert.equal(await limit('a'), true);
  assert.equal(await limit('a'), true);
  assert.equal(await limit('a'), false);
  assert.equal(await limit('b'), true);
  assert.equal(await limit('c'), false);
  time += 60;
  assert.equal(await limit('c'), true);
  assert.equal(await limit('a'), true);
});

test('does not claim success if provider rejects mail or returns no reference', async () => {
  for (const overrides of [{ deliveryStatus: 500 }, { deliveryStatus: 429 }, { delivery: {} }]) {
    assert.equal((await harness(overrides).send(request())).status, 502);
  }
});

test('outbound errors and timeouts fail closed without exposing secrets', async () => {
  for (const failAt of ['siteverify', 'emails']) {
    const calls = [];
    const fetcher = async (endpoint, { signal }) => {
      calls.push(endpoint);
      if (!endpoint.includes(failAt)) return Response.json(verification);
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('private-key and provider details')), { once: true }));
    };
    const response = await handleEnquiry(request(), env, { rateLimit: async () => true, fetcher, timeoutMs: 10 });
    assert.equal(response.status, failAt === 'siteverify' ? 503 : 502);
    assert.doesNotMatch(await response.text(), /private-key/);
    assert.equal(calls.length, failAt === 'siteverify' ? 1 : 2);
  }
});

test('retries of identical messages use the same email idempotency key', async () => {
  const { send, calls } = harness();
  await send(request());
  await send(request({ ...enquiry, 'cf-turnstile-response': 'new-token' }));
  await send(request({ ...enquiry, message: 'A different enquiry' }));
  assert.equal(calls[1].options.headers['Idempotency-Key'], calls[3].options.headers['Idempotency-Key']);
  assert.notEqual(calls[1].options.headers['Idempotency-Key'], calls[5].options.headers['Idempotency-Key']);
});

test('Node adapter sends to the corrected mailbox and never exposes development files', async () => {
  const sent = [];
  const server = createWebsiteServer({ env, fetcher: async (endpoint, options) => {
    if (endpoint.includes('siteverify')) return Response.json({ ...verification, hostname: '127.0.0.1' });
    sent.push(JSON.parse(options.body));
    return Response.json({ id: 'local-mail' });
  } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${origin}/api/enquiry`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(enquiry) })).status, 200);
    assert.deepEqual(sent[0].to, ['INQUIRY@L3GROUP.CO.ZA']);
    for (const pathname of ['/.env', '/.dev.vars', '/.git/config', '/server.mjs', '/worker.mjs', '/enquiry.mjs', '/tests/hero.test.mjs', '/ENQUIRY-SETUP.md']) {
      assert.equal((await fetch(origin + pathname)).status, 404, pathname);
    }
    assert.equal((await fetch(`${origin}/contact.html`)).status, 200);
    assert.equal((await fetch(`${origin}/enquiry-form.js`)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Cloudflare Worker routes enquiries to shared validation and uses trusted IP limits', async () => {
  const keys = [];
  const workerEnv = { ...env, ENQUIRY_RATE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
  const response = await worker.fetch(request(enquiry, { 'CF-Connecting-IP': '192.0.2.4', 'X-Forwarded-For': 'spoofed' }), workerEnv);
  assert.equal(response.status, 429);
  assert.deepEqual(keys, ['l3-enquiry:192.0.2.4']);
  assert.equal((await worker.fetch(request(), workerEnv)).status, 503);
  assert.equal((await worker.fetch(new Request('https://l3group.co.za/api/enquiry/config', { headers: { 'CF-Connecting-IP': '192.0.2.4' } }), workerEnv)).status, 200);
  workerEnv.ASSETS = { fetch: async () => new Response('static page') };
  assert.equal(await (await worker.fetch(new Request('https://l3group.co.za/index.html'), workerEnv)).text(), 'static page');
});

test('deployment config runs the API Worker and excludes private assets', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.main, 'worker.mjs');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.equal(config.vars.L3_TO_EMAIL, env.L3_TO_EMAIL);
  assert.equal(config.ratelimits[0].name, 'ENQUIRY_RATE_LIMITER');
  const ignored = await readFile(new URL('../.assetsignore', import.meta.url), 'utf8');
  for (const pattern of ['.env*', '.dev.vars*', '.git/', 'worker.mjs', 'enquiry.mjs', 'server.mjs', 'tests/']) assert.ok(ignored.includes(pattern));
});
