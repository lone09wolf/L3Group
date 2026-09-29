# L3 Group

A responsive website with a dependency-free Node server for secure enquiry delivery. The visual site also works on a static host; in that mode, the enquiry form opens a prepared email draft.

## Contact

- Phone: +27 84 524 9087
- Email: inquiry@i3group.co.za
- The enquiry form first posts to `/api/enquiry`. Configure `RESEND_API_KEY` and `L3_FROM_EMAIL` on a Node host to deliver enquiries directly. `L3_FROM_EMAIL` must use a sending domain verified by the email provider.
- Without those environment variables or on static hosting, the form opens a prefilled email draft. Direct phone and email links remain available.
- The server validates field lengths, escapes submitted text, limits request size, includes a hidden spam trap, and rate-limits repeated attempts by address.

## Content

The 14 construction photographs, logo and contact details were supplied by the owner. The site uses the original photographs, with no generated additions or retouching. Photo dates follow their source filenames. The screenshot is labelled as an archive copy, not a separate progress milestone.

The 2021 and 2022 photographs are presented as separate site records. No project name, location, building count, certification or handover status is inferred. Stages may show different units or work areas. Demo project lists and unverified metrics have been removed in favour of the real photographs.

## Assets

The live page serves the owner's construction photographs from `assets/projects/`. Gallery photographs load on demand; the full source frame is preserved in the project viewer, and each featured photo links to its full-size file. The consulting service uses `assets/drawings.jpg` as an explicitly labelled illustrative placeholder. Other earlier stock images remain in the asset folder but are not referenced by the page. Lucide's license is included in `assets/lucide-LICENSE`. The typography uses the visitor's native system font stack, so no web font blocks rendering.

Responsive WebP copies are stored in `assets/projects/web/` at 640, 1280 and 1920 pixels. The browser chooses an appropriate size while the original JPG remains available from the full-size link.

## Run

```powershell
node server.mjs
```

Set `PORT` when the hosting platform provides a port. Keep `RESEND_API_KEY` in the host's secret environment settings, never in browser code or source control.

## Interaction

The logo scales within a fixed header. The static hero uses a brief text reveal, while below-the-fold sections reveal as they enter view. Reduced-motion preferences disable these animations. The mobile menu supports keyboard focus, Escape, and background interaction blocking. Service links preselect the relevant enquiry option; project records and frequently asked questions expand on demand.
