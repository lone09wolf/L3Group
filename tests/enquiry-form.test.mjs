import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../enquiry-form.js', import.meta.url), 'utf8');
const fields = { name: 'Test Visitor', email: 'visitor@example.com', location: 'Cape Town', service: 'Construction', message: 'Test enquiry', website: '' };

async function harness({ config = Response.json({ siteKey: 'test-key' }), delivery = () => Response.json({ ok: true }) } = {}) {
  const events = new Map();
  const pageEvents = new Map();
  const calls = [];
  const submit = { disabled: true };
  const status = { textContent: '' };
  const verificationStatus = { textContent: '', after() {} };
  const retry = { addEventListener() {} };
  const service = { options: [{ value: 'Construction' }, { value: 'Renovations' }], value: '' };
  let options;
  let resets = 0;
  let widgetResets = 0;
  const form = {
    querySelector: selector => ({ 'button[type="submit"]': submit, '[data-form-status]': status, '[data-verification-status]': verificationStatus, '[data-form-verification]': {} })[selector],
    elements: { namedItem: () => service },
    addEventListener: (name, callback) => events.set(name, callback),
    reportValidity: () => true, setAttribute() {}, removeAttribute() {},
    reset() { resets++; },
  };
  const turnstile = {
    ready(callback) { callback(); }, remove() {},
    render(container, value) { options = value; return 'widget'; },
    reset() { widgetResets++; },
  };
  runInNewContext(source, {
    document: { querySelector: () => form, createElement: () => retry },
    window: { location: { search: '?service=Renovations' }, matchMedia: () => ({ matches: false }), turnstile, addEventListener: (name, callback) => pageEvents.set(name, callback) },
    URLSearchParams, AbortSignal, setTimeout, clearTimeout,
    FormData: class { *[Symbol.iterator]() { yield* Object.entries(fields); } },
    fetch: async (url, value) => {
      if (url.endsWith('/config')) return config;
      calls.push(JSON.parse(value.body));
      return delivery();
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { submit, status, verificationStatus, service, calls, retry,
    options: () => options, send: () => events.get('submit')({ preventDefault() {} }),
    resets: () => resets, widgetResets: () => widgetResets, pageshow: () => pageEvents.get('pageshow')({ persisted: true }) };
}

test('preselects services and enables sending only after verification', async () => {
  const form = await harness();
  assert.equal(form.service.value, 'Renovations');
  assert.equal(form.submit.disabled, true);
  await form.send();
  assert.equal(form.calls.length, 0);
  form.options().callback('verified-token');
  assert.equal(form.submit.disabled, false);
  await form.send();
  assert.equal(form.calls[0]['cf-turnstile-response'], 'verified-token');
  assert.match(form.status.textContent, /has been sent/);
  assert.equal(form.resets(), 1);
  assert.equal(form.widgetResets(), 1);
  assert.equal(form.submit.disabled, true);
});

test('expired tokens and back-forward restores require new verification', async () => {
  const form = await harness();
  form.options().callback('verified-token');
  form.options()['expired-callback']();
  assert.equal(form.submit.disabled, true);
  assert.equal(form.retry.hidden, false);
  await form.send();
  assert.equal(form.calls.length, 0);
  form.options().callback('new-token');
  form.pageshow();
  assert.equal(form.submit.disabled, true);
  assert.equal(form.widgetResets(), 1);
});

test('delivery failures preserve input and never claim success', async () => {
  for (const delivery of [() => Response.json({ error: 'Please wait one minute.' }, { status: 429 }),
    () => Response.json({ ok: false }), () => new Response('not json'), () => { throw new TypeError('Network failed'); }]) {
    const form = await harness({ delivery });
    form.options().callback('verified-token');
    await form.send();
    assert.equal(form.resets(), 0);
    assert.equal(form.widgetResets(), 1);
    assert.doesNotMatch(form.status.textContent, /has been sent/);
    assert.equal(form.submit.disabled, true);
  }
});

test('missing configuration disables the form and explains direct contact', async () => {
  const form = await harness({ config: Response.json({ error: 'Please email inquiries@l3group.co.za.' }, { status: 503 }) });
  assert.equal(form.submit.disabled, true);
  assert.equal(form.options(), undefined);
  assert.match(form.verificationStatus.textContent, /inquiries@l3group.co.za/);
  assert.equal(form.retry.hidden, false);
});

test('ignores duplicate submit events while an enquiry is in flight', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const form = await harness({ delivery: () => pending });
  form.options().callback('verified-token');
  const sending = form.send();
  await form.send();
  assert.equal(form.calls.length, 1);
  assert.equal(form.submit.disabled, true);
  finish(Response.json({ ok: true }));
  await sending;
  assert.equal(form.resets(), 1);
});
