# L3 Group

A responsive website with Cloudflare Workers hosting, server-verified Turnstile protection, and Resend enquiry delivery. A dependency-free Node server provides the same enquiry API locally. Static-only hosting can display the site but cannot send enquiries.

## Contact

- Phone: +27 84 498 3650
- Email: inquiries@l3group.co.za (Namecheap mailbox).
- The form posts to `/api/enquiry`. The recipient is configured server-side; visitors cannot choose another destination. The verified sending address is used as From, and the visitor's email is Reply-To.
- The endpoint verifies every Turnstile token's success, hostname, and action before contacting Resend. It rejects cross-origin requests, invalid fields, and bodies over 12 KB, and includes a hidden spam trap.
- Cloudflare's rate-limit binding limits attempts to five per minute per IP, per Cloudflare location. The local Node server uses a bounded in-memory limiter. These limits are abuse controls, not a global quota or standalone DDoS protection.
- Identical messages use a Resend idempotency key to prevent duplicate emails for the provider's 24-hour retention window. No automatic provider retry is performed.
- Missing configuration disables online submission honestly. Direct phone, WhatsApp, and email links remain available. A successful response means Resend accepted the message, not that inbox delivery has been verified.
- See [ENQUIRY-SETUP.md](ENQUIRY-SETUP.md) for activation and testing.

## Content

The owner-supplied media is organized into residential, building and masonry, and civil-work collections. The WhatsApp collection contributes 39 photographs and two site videos. Public captions, page titles and footers are date-free. Legacy year-based project URLs redirect to the descriptive collection pages.

Captions describe the visible work. No project name, location, building count or handover date is inferred from a filename. Stages may show different units or work areas.

## Assets

New media is served from `assets/site-media/`. Each photograph has 480-pixel and 1600-pixel WebP copies, without enlarging smaller originals. Gallery thumbnails load on demand; the photo viewer preserves the full frame and supports previous/next controls, arrow keys and Escape. The original townhouse hero and kitchen finishes remain in `assets/projects/`. Lucide's license is included in `assets/lucide-LICENSE`.

The townhouse hero uses owner-supplied before/after photographs, with responsive WebP copies in `assets/hero/`. Its wordmark displays the lettering from the original logo asset. Videos use native playback controls, load only on demand and never autoplay. The Node server supports byte-range requests for playback and seeking. All imported media files are below the Workers static-asset size limit.

## Run

```powershell
node server.mjs
```

Set `PORT` when the hosting platform provides a port. For a configured local form, put the settings from `.dev.vars.example` in an ignored `.env` file and run `node --env-file=.env server.mjs`. Use Node 22 or later. Never put secret keys in browser code or source control. The server does not serve dotfiles, tests, or backend modules.

The Projects page links to `assets/l3-group-company-portfolio.pdf`. This is a placeholder path; add the approved PDF at that exact path before advertising the download as available.

Production uses `worker.mjs`, the ASSETS binding, and Worker-first routing for `/api/*` in `wrangler.jsonc`. The deploy command remains `npx wrangler deploy`; no site build command is needed. Set all form credentials on the Worker before deployment, then send a real test and confirm receipt in the Namecheap inbox. `.assetsignore` excludes backend modules, secrets, and development files from public asset uploads.

## Interaction

The logo scales within a fixed header. The homepage hero holds on the construction photograph for one second, then fades smoothly to the finished homes over one second and remains still. The reveal replays on page loads and back-forward restores; reduced-motion visitors see the completed image immediately. Three spaced, staggered team portraits retain the orange accents and curved corners in the Why L3 section. The separate gallery strip moves right to left and offers a pause control. Reduced-motion preferences disable automatic gallery motion. The mobile menu supports keyboard focus, Escape, and background interaction blocking. Service links preselect the relevant enquiry option.
