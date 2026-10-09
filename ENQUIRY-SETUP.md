# Activate the L3 Group enquiry form

## Mailbox and sending service

The receiving mailbox is `inquiries@l3group.co.za`, hosted by Namecheap. Keep its existing MX records. A mailbox alone does not execute the website's email handler: Cloudflare runs the Worker, and the existing Resend integration sends to the mailbox over HTTPS. No Namecheap mailbox password is needed by this implementation.

1. Confirm the `inquiries` mailbox exists in Namecheap and receives ordinary email.
2. In Resend, verify a sending domain or subdomain you control, for example `forms.l3group.co.za`. Add only the DNS records Resend specifies for that sending domain/subdomain. Do not replace the main domain's Namecheap MX records. Coordinate SPF/DKIM changes with the existing DNS setup; do not create duplicate SPF records at the same hostname.
3. Create a sending-only Resend API key scoped to that domain. Choose a verified sender, for example `website@forms.l3group.co.za`.

## CAPTCHA

Create a reCAPTCHA v3 (score-based) site key and secret for each public hostname that serves the contact form, such as `l3group.co.za` and `www.l3group.co.za`. If you use a workers.dev preview, register that hostname too or use a separate testing key. This is the classic reCAPTCHA v3 site/secret integration using Google's SiteVerify endpoint, not a Turnstile widget or reCAPTCHA Enterprise API key. The form obtains a fresh token on submission; the Worker verifies its hostname, `enquiry` action, and score (minimum 0.5) before sending mail. The Google badge remains visible as required by the service.

Automated tests mock the verification and email APIs; they do not bypass production verification. Do not paste the secret into source code or chat.

## Worker settings

In Cloudflare, open Workers & Pages > l3group > Settings > Variables and Secrets. Add these settings to the production Worker:

| Setting | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | The sending-only API key |
| `RECAPTCHA_SECRET_KEY` | Secret | The real reCAPTCHA v3 secret |
| `RECAPTCHA_SITE_KEY` | Secret or text | The public reCAPTCHA v3 site key |
| `L3_FROM_EMAIL` | Secret or text | The verified sender address |

The receiving address is fixed in the Worker to `inquiries@l3group.co.za`; it cannot be changed by a submitted form field or an old `L3_TO_EMAIL` variable.

For CLI setup, from this repository run:

```powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RECAPTCHA_SECRET_KEY
npx wrangler secret put RECAPTCHA_SITE_KEY
npx wrangler secret put L3_FROM_EMAIL
npx wrangler deploy
```

Using secret storage for all four settings prevents Wrangler's vars configuration from overwriting dashboard-only text values. Enter actual values in Wrangler's secure prompt or Cloudflare's settings, not in a chat or tracked source file.

The repository now includes the Worker entry point, static asset binding, and rate-limit binding. The Workers Builds deployment command remains `npx wrangler deploy` with no build command. Use a unique rate-limit namespace ID if `3001` is already used by another Worker in this Cloudflare account.

## Verify after deployment

1. Open `/api/enquiry/config` on the live hostname. It should return only a public `siteKey`, never secrets. A 503 means configuration is incomplete.
2. Open Contact, wait for the secure form to become available, and submit one clearly labelled test enquiry. reCAPTCHA v3 is invisible; there is no checkbox.
3. Confirm receipt in Namecheap, including Spam/Junk. Check the visitor's address is Reply-To and that replying reaches the visitor. Check Resend's delivery status if the accepted message does not reach the inbox.
4. Check missing, expired, duplicate, wrong-host, wrong-action, and low-score CAPTCHA tokens do not send mail. Confirm repeated attempts return 429 and that errors preserve the visitor's input.
5. Check the mobile form. Direct email, phone, and WhatsApp must still work when the online form is unavailable.

## Abuse and DDoS protection

The form uses a server-verified, single-use CAPTCHA, a spam trap, input and request-size limits, same-origin checks, outbound timeouts, duplicate-message protection, and a five-attempts-per-minute IP limiter. Shared networks can share an IP limit. Cloudflare's Worker limiter is location-local and eventually consistent, not a strict worldwide email budget.

Keep the site behind Cloudflare. Review the zone's Security/WAF protections and, when available on your plan, add an edge rate-limit rule for POST requests to `/api/enquiry`. Watch 403/429 responses and provider email usage. CAPTCHA and application rate limiting reduce spam; they cannot guarantee protection from a distributed denial-of-service attack. Secrets and user enquiry content are never deliberately logged by the handler.

## Local verification

```powershell
node --test tests/*.test.mjs
npx wrangler deploy --dry-run --outdir .wrangler/dry-run
node server.mjs
```

Without credentials the local form correctly remains unavailable. To test real delivery locally, use separate development v3 credentials allowing localhost and an ignored `.env` file with the same setting names as `.dev.vars.example`, then run `node --env-file=.env server.mjs`. Do not allow localhost on the production key. Never commit `.env`, `.dev.vars`, or secret values.

## Official references

- [reCAPTCHA v3 integration](https://developers.google.com/recaptcha/docs/v3)
- [Server-side SiteVerify](https://developers.google.com/recaptcha/docs/verify)
- [Worker static asset routing](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers rate-limit binding and its limitations](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Send Email API and idempotency](https://resend.com/docs/api-reference/emails/send-email)
