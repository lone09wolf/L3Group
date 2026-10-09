import http from 'node:http';
import { createWebsiteServer } from '../server.mjs';

// Browser QA only: use a localhost-enabled v3 site key; outbound email is mocked.
const app = createWebsiteServer({
  env: {
    RESEND_API_KEY: 'mock-email-key', L3_FROM_EMAIL: 'website@example.com',
    RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY || '', RECAPTCHA_SECRET_KEY: 'mock-secret',
  },
  fetcher: async (url, options) => {
    if (url.includes('siteverify')) {
      const token = new URLSearchParams(options.body).get('response');
      return Response.json({ success: Boolean(token), hostname: '127.0.0.1', action: 'enquiry', score: 0.9 });
    }
    if (url !== 'https://api.resend.com/emails') throw new Error('Unexpected test provider');
    console.log('Mock email accepted; no email was sent.');
    return Response.json({ id: 'mock-email-only' });
  },
});
const handle = app.listeners('request')[0];
const preview = http.createServer(handle);
preview.listen(4178, '127.0.0.1', () => console.log('Test-only form: http://127.0.0.1:4178/contact.html#enquiry (NO EMAILS SENT)'));
