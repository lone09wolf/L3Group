# Activate the L3 Group enquiry form

## Mailbox and sending service

The receiving mailbox is `inquiries@l3group.co.za`, hosted by Namecheap. Keep its existing MX records. A mailbox alone does not execute the website's email handler: Cloudflare runs the Worker, and the existing Resend integration sends to the mailbox over HTTPS. No Namecheap mailbox password is needed by this implementation.

1. Confirm the `inquiries` mailbox exists in Namecheap and receives ordinary email.
2. In Resend, verify a sending domain or subdomain you control, for example `forms.l3group.co.za`. Add only the DNS records Resend specifies for that sending domain/subdomain. Do not replace the main domain's Namecheap MX records. Coordinate SPF/DKIM changes with the existing DNS setup; do not create duplicate SPF records at the same hostname.
3. Create a sending-only Resend API key scoped to that domain. Choose a verified sender, for example `website@forms.l3group.co.za`.

## CAPTCHA

In Cloudflare, create a Managed Turnstile widget. Add each public hostname on which the contact form is available, including `l3group.co.za`, `www.l3group.co.za`, or the actual workers.dev hostname as applicable. Use the real public site key and secret key. The code checks the token against the request's hostname and the `enquiry` action.

Public always-pass dummy keys are deliberately rejected by the application configuration. Automated tests mock the verification and email APIs instead; there is no production CAPTCHA bypass.

## Worker settings

In Cloudflare, open Workers & Pages > l3group > Settings > Variables and Secrets. Add these settings to the production Worker:

| Setting | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | The sending-only API key |
| `TURNSTILE_SECRET_KEY` | Secret | The real widget secret |
| `TURNSTILE_SITE_KEY` | Secret or text | The real public site key |
| `L3_FROM_EMAIL` | Secret or text | The verified sender address |
| `L3_TO_EMAIL` | Text | `inquiries@l3group.co.za` (already in wrangler.jsonc) |

For CLI setup, from this repository run:

```powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put L3_FROM_EMAIL
npx wrangler deploy
```

Using secret storage for all four settings prevents Wrangler's vars configuration from overwriting dashboard-only text values. Enter actual values in Wrangler's secure prompt or Cloudflare's settings, not in a chat or tracked source file.

The repository now includes the Worker entry point, static asset binding, and rate-limit binding. The Workers Builds deployment command remains `npx wrangler deploy` with no build command. Use a unique rate-limit namespace ID if `3001` is already used by another Worker in this Cloudflare account.

## Verify after deployment

1. Open `/api/enquiry/config` on the live hostname. It should return only a public `siteKey`, never secrets. A 503 means configuration is incomplete.
2. Open Contact, complete the CAPTCHA, and submit one clearly labelled test enquiry.
3. Confirm receipt in Namecheap, including Spam/Junk. Check the visitor's address is Reply-To and that replying reaches the visitor. Check Resend's delivery status if the accepted message does not reach the inbox.
4. Check missing, expired, duplicate, wrong-host, and wrong-action CAPTCHA tokens do not send mail. Confirm repeated attempts return 429 and that errors preserve the visitor's input.
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

Without credentials the local form correctly remains unavailable. To test real delivery locally, use separate development widget credentials allowing localhost and an ignored `.env` file with the same setting names as `.dev.vars.example`, then run `node --env-file=.env server.mjs`. Do not allow localhost on the production widget. Never commit `.env`, `.dev.vars`, or secret values.

## Official references

- [Server-side Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Worker static asset routing](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers rate-limit binding and its limitations](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Send Email API and idempotency](https://resend.com/docs/api-reference/emails/send-email)
