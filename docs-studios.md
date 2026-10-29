# Studio page and WhatsApp enquiries

The public `/studios` page and homepage `#studios` section use `data/studios.json`. Both locations and the shared shooting floor, podcast room, makeup room, pantry and in-house gear are based on the supplied brief. No prices, sizes, capacities, opening hours, equipment inclusions beyond the brief, or soundproofing claims are invented.

Homepage placement is immediately before the live catalogue, now anchored as `#catalogue`. This checkout did not contain a wedding-combos section, so none was replaced or fabricated. Existing equipment date selection, catalogue and request flow are retained. The primary booking button still leads to the existing store; the new secondary hero link scrolls to Studios.

## Files

- `data/studios.json`: studio text, address/maps data, facilities, image paths/alt text, podcast packages, WhatsApp destination and TODOs.
- `app/components/studios.tsx`: gallery, cards, packages and accessible native request dialog.
- `app/components/studio-schema.tsx`: LocalBusiness JSON-LD for both locations, omitting unknown address/Maps data and sample photos.
- `app/studios/page.tsx`, `app/studios.css`: public studio-booking page and scoped brand styling.
- `app/page.tsx`, `app/components/public-site.tsx`, `app/sitemap.ts`: homepage section/navigation, shared Studios navigation and sitemap entry.
- `public/assets/studios/*.jpg`: 13 local compressed placeholders; `tests/studios.e2e.ts`: workflow and responsive checks.

## All remaining TODOs

1. Replace these Thammanam samples with genuine photos: `thammanam-hero.jpg`, `thammanam-shooting-floor.jpg`, `thammanam-podcast-room.jpg`, `thammanam-makeup-room.jpg`, `thammanam-pantry.jpg`.
2. Replace these Vennala samples: `vennala-hero.jpg`, `vennala-shooting-floor.jpg`, `vennala-podcast-room.jpg`, `vennala-makeup-room.jpg`, `vennala-pantry.jpg`.
3. Replace `podcast-package-1.jpg`, `podcast-package-2.jpg`, `podcast-package-3.jpg`.
4. Heroes are 1600×900; all other samples are 1200×900. Replace files using the same paths to update images without code changes. Update alt text in JSON and set each studio's `placeholderImages` to false after replacing all its samples; package `placeholder` flags should be false only after names and inclusions are confirmed.
5. Add the full verified Vennala street address and actual Google Maps place URL. No Vennala direction link is fabricated.
6. Confirm the exact Thammanam Maps place pin. Its current Maps search link uses the supplied address, `Felix Rd, DD Village, Thammanam, Ernakulam, Kerala 682032`; it is an address search, not a verified pin.
7. Confirm real names and distinct inclusions for all three podcast packages. Current names are numbered placeholders, with only podcast-room session and editing listed. Do not add rates or guessed camera/microphone/operator inclusions.
8. Studio dates are preferred-date enquiries, not live availability or confirmed reservations. Our representative must confirm details with the customer.

## Request behaviour

Required fields: full name, phone, studio, need, preferred date/time (IST), people and yes/no gear. Notes are optional. Package enquiries preselect the package and need. All requests prepare the specified message for `https://wa.me/917736655080?text=...` using encodeURIComponent. The browser opens WhatsApp on the submit gesture and displays a fallback link if popups are blocked. The customer must press Send in WhatsApp. No automated outbound WhatsApp message is sent by the app and no booking is falsely marked confirmed.

If an existing trusted integration sets `window.CAMNOVA_REQUEST_URL`, the same contact/booking fields are additionally POSTed as JSON to that endpoint. It must be HTTPS or same-origin. No endpoint is configured by default; these enquiries do not automatically create equipment bookings or trigger the staff equipment-request counter. A failed optional POST leaves the WhatsApp action available and reports the failure.

The existing owner-managed detailed studio/podcast templates remain separate and unpublished until their fuller verified specifications and pricing are ready. The new public studio enquiry page intentionally shows only facts supplied in this brief, with no prices.

## Validation

Production build passed. All 14 Playwright browser tests passed, including the existing equipment/customer/staff/payment workflows and new studio tests. Studio checks cover 360/768/1280-pixel layouts, no horizontal overflow, keyboard gallery controls, required-field validation, package preselection, WhatsApp payload/destination, optional JSON POST, Escape-to-close, SEO metadata and both location records. All 13 local JPEG dimensions and formats were verified (252,667 bytes total). No new database migration, dependency or studio pricing was added.
