import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../enquiry-form.js', import.meta.url), 'utf8');
const fields = { name: 'Test Visitor', email: 'visitor@example.com', location: 'Cape Town', service: 'Construction', message: 'Test enquiry', website: '' };

async function harness({ config = Response.json({ siteKey: 'test-key' }), delivery = () => Response.json({ ok: true }), execute = async () => 'fresh-token' } = {}) {
  const events = new Map();
  const calls = [];
  const executions = [];
  const submit = { disabled: true };
  const status = { textContent: '' };
  const verificationStatus = { textContent: '', after() {} };
  const retry = { addEventListener(name, callback) { events.set('retry', callback); }, hidden: true };
  const service = { options: [{ value: 'Construction' }, { value: 'Renovations' }], value: '' };
  let resets = 0;
  const form = {
    querySelector: selector => ({ 'button[type="submit"]': submit, '[data-form-status]': status, '[data-verification-status]': verificationStatus })[selector],
    elements: { namedItem: () => service },
    addEventListener: (name, callback) => events.set(name, callback),
    reportValidity: () => true, setAttribute() {}, removeAttribute() {},
    reset() { resets++; },
  };
  const grecaptcha = {
    ready(callback) { callback(); },
    async execute(key, options) { executions.push({ key, action: options.action }); return execute(); },
  };
  runInNewContext(source, {
    document: { querySelector: () => form, createElement: () => retry },
    window: { location: { search: '?service=Renovations' }, grecaptcha },
    URLSearchParams, AbortSignal, setTimeout, clearTimeout,
    FormData: class { *[Symbol.iterator]() { yield* Object.entries(fields); } },
    fetch: async (url, value) => {
      if (url.endsWith('/config')) return config;
      calls.push(JSON.parse(value.body));
      return delivery();
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { submit, status, verificationStatus, service, calls, executions, retry,
    send: () => events.get('submit')({ preventDefault() {} }), resets: () => resets };
}

test('preselects service and obtains a fresh v3 token for each submission', async () => {
  const form = await harness();
  assert.equal(form.service.value, 'Renovations');
  assert.equal(form.submit.disabled, false);
  await form.send();
  await form.send();
  assert.equal(form.calls.length, 2);
  assert.equal(form.calls[0]['g-recaptcha-response'], 'fresh-token');
  assert.deepEqual(form.executions, [
    { key: 'test-key', action: 'enquiry' }, { key: 'test-key', action: 'enquiry' },
  ]);
  assert.match(form.status.textContent, /has been sent/);
  assert.equal(form.resets(), 2);
  assert.equal(form.submit.disabled, false);
});

test('delivery and verification failures preserve form input and never claim success', async () => {
  for (const options of [
    { delivery: () => Response.json({ error: 'Please wait one minute.' }, { status: 429 }) },
    { delivery: () => Response.json({ ok: false }) },
    { delivery: () => new Response('not json') },
    { delivery: () => { throw new TypeError('Network failed'); } },
    { execute: async () => { throw new Error('CAPTCHA blocked'); } },
  ]) {
    const form = await harness(options);
    await form.send();
    assert.equal(form.resets(), 0);
    assert.doesNotMatch(form.status.textContent, /has been sent/);
    assert.equal(form.submit.disabled, false);
  }
});

test('missing configuration disables the form and explains direct contact', async () => {
  const form = await harness({ config: Response.json({ error: 'Please email inquiries@l3group.co.za.' }, { status: 503 }) });
  assert.equal(form.submit.disabled, true);
  assert.match(form.verificationStatus.textContent, /inquiries@l3group.co.za/);
  assert.equal(form.retry.hidden, false);
  await form.send();
  assert.equal(form.executions.length, 0);
});

test('ignores duplicate submit events while an enquiry is in flight', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const form = await harness({ delivery: () => pending });
  const sending = form.send();
  await form.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(form.calls.length, 1);
  assert.equal(form.executions.length, 1);
  assert.equal(form.submit.disabled, true);
  finish(Response.json({ ok: true }));
  await sending;
  assert.equal(form.resets(), 1);
});
