import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWebsiteServer } from '../server.mjs';

const server = createWebsiteServer();
const originalFetch = globalThis.fetch;
let endpoint;
let deliveryPayload;
let deliveryStatus = 200;

before(async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.L3_FROM_EMAIL = 'website@example.com';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    deliveryPayload = JSON.parse(options.body);
    return new Response('{}', { status: deliveryStatus });
  };
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${server.address().port}/api/enquiry`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.L3_FROM_EMAIL;
  await new Promise((resolve) => server.close(resolve));
});

const enquiry = {
  name: 'Test Visitor', email: 'visitor@example.com', location: 'Cape Town',
  service: 'Construction', message: 'A test project enquiry', website: '',
};

async function post(body) {
  return originalFetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('sends a valid enquiry to the specified mailbox', async () => {
  deliveryStatus = 200;
  const response = await post(enquiry);
  assert.equal(response.status, 200);
  assert.deepEqual(deliveryPayload.to, ['INQIURY@L3GROUP.CO.ZA']);
  assert.equal(deliveryPayload.reply_to, enquiry.email);
  assert.match(deliveryPayload.html, /A test project enquiry/);
});

test('rejects invalid enquiries without sending', async () => {
  deliveryPayload = undefined;
  const response = await post({ ...enquiry, email: 'invalid' });
  assert.equal(response.status, 400);
  assert.equal(deliveryPayload, undefined);
});

test('does not claim success when the mail provider rejects delivery', async () => {
  deliveryStatus = 500;
  const response = await post(enquiry);
  assert.equal(response.status, 502);
});
