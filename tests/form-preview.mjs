import http from 'node:http';
import { createWebsiteServer } from '../server.mjs';

// Browser QA only: dummy CAPTCHA site key and mocked outbound services, no email.
const app = createWebsiteServer({
  env: {
    RESEND_API_KEY: 'mock-email-key', L3_FROM_EMAIL: 'website@example.com',
    TURNSTILE_SITE_KEY: 'mock-site-key', TURNSTILE_SECRET_KEY: 'mock-secret',
  },
  fetcher: async (url, options) => {
    if (url.includes('siteverify')) {
      const token = JSON.parse(options.body).response;
      return Response.json({ success: token === 'XXXX.DUMMY.TOKEN.XXXX', hostname: '127.0.0.1', action: 'enquiry' });
    }
    if (url !== 'https://api.resend.com/emails') throw new Error('Unexpected test provider');
    console.log('Mock email accepted; no email was sent.');
    return Response.json({ id: 'mock-email-only' });
  },
});
const handle = app.listeners('request')[0];
const preview = http.createServer((request, response) => {
  if (request.url === '/api/enquiry/config' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ siteKey: '1x00000000000000000000AA' }));
    return;
  }
  return handle(request, response);
});
preview.listen(4178, '127.0.0.1', () => console.log('Test-only form: http://127.0.0.1:4178/contact.html#enquiry (NO EMAILS SENT)'));
