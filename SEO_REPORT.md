# L3 Group SEO implementation report

## Status

Implemented and tested locally. Production DNS, TLS, edge redirects, indexing and email delivery require post-deployment verification.

Canonical origin is **https://l3group.co.za**, pending owner confirmation. Do not publish conflicting www/non-www canonicals. The confirmed enquiry mailbox remains **inquiries@l3group.co.za** and telephone **+27 84 498 3650**.

## Changes made

- Nine indexable pages have unique relevant titles/descriptions, one H1, consistent HTTPS canonicals, Open Graph and Twitter metadata. No important page has a noindex directive; only the intentional error page does.
- Added JSON-LD Organization, WebSite, appropriate page types, BreadcrumbList on inner pages and six Service entities. No invented address, review, rating, credentials or business dates were added.
- Prerendered navigation, footer and project photo galleries in HTML. Search engines and visitors without JavaScript can follow the site and view gallery content. JavaScript still enhances the menu, reveal animation, scrolling gallery and lightbox.
- Added a nine-URL sitemap and robots file referencing it. Clean extensionless URLs have permanent redirects from existing HTML and legacy project URLs. A branded error page returns an actual 404.
- Added the supplied 13-page company portfolio PDF as a real download on the Projects and Company Portfolio pages. Its 39 MB source was optimized to 3.5 MB while keeping the original page count and extracted text. The temporary redirect from the PDF URL was removed.
- Added descriptive image alternatives and actual dimensions, responsive image sources, below-fold lazy loading, hero prioritization/preload and a share image. Original source files are retained.
- Added AVIF hero variants with WebP fallbacks, WebP portraits/certifications/logos and medium-resolution project photographs. Self-hosted the existing Manrope font with its license, removing the external font stylesheet.
- Deferred scripts, removed a forced hero layout read, batched scroll updates and delayed offscreen gallery initialization. Native offscreen rendering reduces homepage rendering work while preserving anchor navigation and printing.
- Improved keyboard navigation and contrast. Contact-page mobile links use a stable two-column grid to prevent font-loading layout shift. The hero branding, one-second reveal, portraits, light footer and enquiry protection remain intact.
- Added cache/security headers without overlapping Cache-Control rules. Local routing and MIME handling mirror the intended clean-URL deployment.

## Files changed in this pass

| Area | Files |
| --- | --- |
| Page metadata, semantics and static content | `index.html`, `about.html`, `services.html`, `projects.html`, `portfolio.html`, `contact.html`, `projects/residential.html`, `projects/building-works.html`, `projects/civil-works.html` |
| Legacy routes and errors | `projects/2021.html`, `projects/2022.html`, `404.html`, `_redirects` |
| Discovery and deployment | `robots.txt`, `sitemap.xml`, `_headers`, `wrangler.jsonc`, `server.mjs` |
| Presentation and progressive enhancement | `styles.css`, `pages.css`, `script.js`, `media-gallery.js` |
| Tests | `tests/hero.test.mjs`, `tests/routing.test.mjs` |
| Optimized media | `assets/hero/*.avif`, `assets/site-media/photo-*-960.webp`, `assets/portrait-01-*.webp`, `assets/portrait-02-*.webp`, `assets/certifications.webp`, `assets/l3-logo-clean.webp`, `assets/l3-logo-480.webp`, `assets/l3-group-social.jpg`, `assets/fonts/manrope-latin.woff2`, `assets/fonts/OFL.txt`, `assets/l3-group-company-portfolio.pdf` |
| Documentation | `SEO_REPORT.md`, `SEO_BACKLINK_STRATEGY.md` |

The repository was already dirty before this work; Git status also lists earlier website and enquiry changes. Legacy `page-shell.js` remains available but is no longer loaded by these pages.

## Verification

- **33 automated tests passed**, covering enquiry validation/CAPTCHA/rate limiting, hero replay/reduced motion, media limits/video ranges, clean routes, redirects, MIME types and real 404 responses.
- Served-HTML crawl: **9 pages, 183 internal references, 30 fragment targets, 110 images and 41 structured-data entities; zero errors**. This includes metadata uniqueness, one H1, heading order, noindex checks, schema JSON syntax, local asset existence and mixed-content checks. The new PDF download link was also exercised in the browser.
- Sitemap parsed as XML and compared with the complete canonical page set. Robots sitemap declaration and API exclusion checked.
- **45 responsive checks passed**: all nine pages at 320, 390, 768, 1024 and 1440 pixels, with no horizontal page overflow or overflowing text/buttons.
- Menu/Escape focus return, project lightbox navigation, gallery pause/resume, home section anchors and contact service preselection were checked in the browser.
- Cloudflare Wrangler deployment **dry run passed**; no assets uploaded. The separate local Wrangler runtime did not respond reliably and was stopped, so Cloudflare edge behavior still needs a post-deploy smoke test.

## Performance results

Local Lighthouse mobile lab runs, not production field measurements. Lighthouse warned that this machine's CPU is slower than expected; compare results cautiously.

| Page/run | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Home before | 71 | 96 | 100 | 100 | 7.5 s | 0 | 0 ms |
| Home after | 75 | 100 | 100 | 100 | 4.2 s | 0 | 410 ms |
| Residential after | 91 | 100 | 100 | 100 | 3.0 s | 0.022 | 180 ms |
| Contact after | 84 | 100 | 96 | 100 | 2.8 s | 0 | 360 ms |

Home transferred data fell from approximately **3,353 KiB to 627 KiB (81%)**. Contact CLS fell from 0.12 to 0 after stabilizing the mobile links. Contact Best Practices includes an expected local 503 for missing enquiry-provider configuration; the form fails closed rather than claiming it can send.

This is **not a claim that Core Web Vitals pass**. Homepage LCP and lab blocking time still need attention after production measurement. INP requires real interaction/field data and is not established by these Lighthouse scores. Verify edge caching and repeat PageSpeed Insights on production; use the performance trace to decide whether further above-fold styling/rendering changes are worthwhile before changing the design or adding code. Keep future photographs responsive and compressed, and keep videos click-to-play with metadata downloading disabled.

Audit JSON, crawl results and screenshots are saved outside the deployable repository in `C:/Users/Pc dell/Documents/Codex/2026-09-17/referenced-chatgpt-conversation-this-is-an/.seo-tools/`. Key reports: `before-home.json`, `home-offscreen.json`, `final-residential.json`, `contact-final.json`, `crawl-results.json`. No audit dependencies were added to the website.

## Owner and production actions

1. Review the local preview and deploy the tested changes. Confirm the primary origin is the apex domain above; update canonicals, schema, social URLs, sitemap and robots together if a different hostname is chosen.
2. In Cloudflare, verify HTTP-to-HTTPS and www-to-apex redirects preserve paths and queries. Check `/`, `/services`, `/projects`, `/contact`, old `.html` URLs, `/robots.txt`, `/sitemap.xml` and an invented URL returning 404. Ensure production does not add noindex headers, authentication or crawler-blocking challenges to public pages.
3. Confirm production Turnstile/email-provider secrets and real delivery to `inquiries@l3group.co.za` using `ENQUIRY-SETUP.md`. No real email was sent during SEO verification; local missing credentials do not prove that production is misconfigured.
4. Confirm rights and factual accuracy for project imagery and certification claims before expanding structured data. Supply accurate captions/transcripts for any videos containing meaningful speech.
5. Follow `SEO_BACKLINK_STRATEGY.md`; no backlinks were fabricated or purchased.

## Google Search Console

1. Add a **Domain property for l3group.co.za**. Add Google's verification TXT record at the authoritative DNS provider, which may differ from the domain registrar. Preserve Namecheap mail/MX records. No verification token has been fabricated or inserted.
2. After deployment and verification, submit `https://l3group.co.za/sitemap.xml`.
3. Use URL Inspection's live test for the homepage, services, projects and contact pages; check crawlability and the selected canonical, then request indexing for key pages.
4. Validate deployed structured data with Google's Rich Results Test and Schema.org Validator. Local JSON validation passed, but valid Organization/WebSite/Service markup does not guarantee a rich result.
5. Monitor Page Indexing, Core Web Vitals and search performance after recrawling and sufficient real-user data. Submission does not guarantee indexing or rankings.

References: [Google site verification](https://support.google.com/webmasters/answer/9008080), [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization), [LCP optimization](https://web.dev/articles/optimize-lcp), [Cloudflare redirects](https://developers.cloudflare.com/workers/static-assets/redirects/).
