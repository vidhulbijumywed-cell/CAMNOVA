# CAMNOVA public website and SEO release

## Audit and architecture

The existing app is Next.js 16 App Router on Render, PostgreSQL/Prisma on Neon, with server-authorized staff/customer APIs and an existing booking/payment ledger. The homepage is public; staff lives at `/workspace`; customers use `/rentals` and `/customer/login`. Rental inventory was already passed to a client component from the server, but inherited noindex and had no crawlable equipment-detail URLs. There were no sitemap, robots route, canonical origin configuration or editable public service pages.

The implementation retains Next.js and all existing booking/database workflows. Server-rendered category and detail pages read inventory through a safe select excluding costs, private notes, customer records and serials. Dates and request submission continue through existing live APIs. Prices are current on each request; there is no long-lived price/availability cache. Temporary booked/maintenance equipment stays discoverable while its asset is not retired. Rates distinguish started 24-hour periods and calendar days according to business settings.

Public content uses existing `Setting` rows prefixed `public:`. No schema migration or data backfill is required. An owner edits Website content & SEO from Workspace → Settings, or `/workspace/content`. Staff cannot change public content. Content is plain text, never executable HTML. Equipment photos are maintained through Inventory; studio photo URLs must use HTTPS. The studio floor and podcast studio templates default to unpublished drafts. A procedural rental-planning guide is provided and can be edited/unpublished in the same screen.

## Routes and intent

| URL | Intent / publication rule |
| --- | --- |
| `/` | CAMNOVA brand, The Complete Creator Space, equipment rental in Kochi |
| `/rentals` | All real rental inventory; interactive availability + crawlable directory |
| `/rentals?page=N` | Crawlable directory pagination, distinct self canonical |
| `/camera-rental-kochi` | Camera rental / camera rent / camera rentals in Kochi |
| `/lens-rental-kochi` | Lens rental / lens rent in Kochi |
| `/lighting-rental-kochi` | Photo/video lighting rental in Kochi |
| `/gimbal-rental-kochi` | Gimbal rental in Kochi |
| `/audio-rental-kochi` | Microphone/audio equipment rental in Kochi |
| `/rentals/[slug]` | Model-specific rental intent; real equipment/photo/rate |
| `/studio-rental-kochi` | Studio floors / studio rental in Kochi; only verified operational records |
| `/podcast-studio-kochi` | Podcast studio rental; only verified operational records |
| `/studios/[slug]` | Verified individual space |
| `/guides` and `/guides/[slug]` | Published helpful rental-planning guides |
| `/about` | User-supplied CAMNOVA Rentals / Camnova Private Limited identity, Kochi market |
| `/contact` | Verified public contact and pickup arrangements |

Empty categories, all-retired equipment, unpublished overrides, unavailable studio drafts and nonexistent resources return 404. Arbitrary one-segment URLs are not treated as landing pages. Studio/podcast navigation appears only when a real operational record is published. No duplicate Cochin/Ernakulam location pages are generated.

## Redirect map and indexing

Existing public URLs are retained; there is no bulk old-to-new redirect or homepage catch-all. Equipment first gets a stable readable slug ending in its existing ID. If the owner customizes it, its original generated URL permanently redirects (308) to the current slug. Subsequent old equipment, studio and guide slugs are retained as aliases and redirect directly to the latest published equivalent without chains. Category URLs are fixed to the canonical intent map. Unpublished/removed pages return 404 rather than redirecting to unrelated pages. Next.js normalizes trailing slashes to its default slashless form.

Canonical/Open Graph URLs use one production origin. Tracking, sorting, arbitrary dates, search and filter variants of `/rentals` are noindex, follow with a clean canonical. The `item` query carries an item into the request cart and is also noindex. Pagination canonicals retain their page number and expose every item via HTML links. robots.txt allows crawling, including private routes so their inherited noindex can be seen; robots is not an authorization mechanism. Staff pages, authentication pages, APIs and account content are never added to the sitemap. Customer account/request data is loaded only after authorization. Search Console removals/indexing cannot be guaranteed by code.

## Environment and deployment

Optional new variable: `PUBLIC_SITE_URL=https://camnova.onrender.com` (default). Keep this origin until a custom domain is confirmed. Existing DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL and deployment commands remain required and unchanged. Do not put secrets in PUBLIC_SITE_URL.

Use the existing release workflow; this work does not deploy production, purchase a domain, change DNS, submit to Search Console or edit Google Business Profile. Build: `npm run build`. Start: existing `bash scripts/deploy-start.sh` (or the current Render command). Existing database migrations run as before; no new migration is introduced here.

For a future domain migration: confirm ownership/DNS and existing email records; configure the custom domain and HTTPS in Render; set PUBLIC_SITE_URL and NEXTAUTH_URL to the same approved origin; verify login/canonical/sitemap responses; configure permanent same-path redirects from the previous hostname using the hosting/domain configuration; submit the new sitemap and use Search Console's domain-migration process where applicable. Do not redirect login APIs across hosts or switch origins without verifying sessions and callbacks.

## Missing verified information

- Full street address, postcode and exact pickup/access instructions.
- Public telephone/WhatsApp number and business opening hours.
- Approved Maps URL and business listing; legal identity beyond the user-supplied name.
- Equipment descriptions/specifications, compatibility, included accessories and actual photos for any item missing one.
- Verified deposit/ID requirements and model-specific terms.
- Studio dimensions, ceiling height, capacity, facilities/backdrops, power, AC, parking/changing facilities, real photos/floor plan, minimum duration, inclusions and additional charges.
- Podcast seating, microphones, cameras, operator/editing/file-delivery inclusions, acoustic treatment and isolation; never assume soundproofing.
- Genuine customer reviews/photographs with permission. No ratings/review claims are fabricated.

Contact remains useful without guessing missing details: it identifies Kochi, links to the rental-request flow and tells visitors to confirm pickup arrangements. Add only verified business data through the public business profile. Studio publication is blocked until required detail labels are populated and the owner marks the service verified and operational. Write `not provided` or `not available` only when that status is verified, rather than making claims to bypass validation.

## Structured data, analytics and measurement

Visible homepage data produces WebSite and LocalBusiness JSON-LD; public pages include BreadcrumbList and rental Service data. Rental Offers use LeaseOut and UnitPriceSpecification, not sale Product offers or invented InStock statuses. No aggregate ratings or guaranteed Google rich results are claimed. JSON-LD is escaped for safe script embedding. FAQ content is visible but FAQ rich results are not promised.

No analytics provider/configuration was present, so none is installed or sent customer data. Once a consent/analytics approach is approved, instrument equipment/service views, availability checks, booking starts, server-confirmed bookings, submitted enquiries and phone/WhatsApp clicks separately. Never treat a WhatsApp click or a draft request as a confirmed booking; never send phone/name/email into analytics.

Performance is evaluated locally with production build/browser measurements. These are lab checks, not real-user Core Web Vitals. Above-the-fold assets are eager; catalogue images have fixed dimensions and lazy loading; fonts are local. No analytics score, Search Console validation, rich-result eligibility, ranking or indexing guarantee is made.

## Manual launch checklist

- Owner verifies and saves contact/business profile; complete inventory descriptions/photos and publish only operational services.
- Use existing release review, deploy, then check representative public pages, noindex private pages, sitemap and robots on the actual origin.
- Verify Search Console ownership; submit `/sitemap.xml`; inspect representative public URLs; review indexing exclusions and duplicate canonicals.
- Verify Google Business Profile name/address/telephone/hours/category/service descriptions and correct pin; use genuine business/gear/studio photos.
- Request genuine customer feedback without incentives or fabricated reviews; keep website and profile contact details consistent.
- Monitor Search Console errors, enquiries vs confirmed bookings, database/application resource use, and real-user Core Web Vitals after sufficient traffic.

## Validation recorded in this workspace

Initial production build passed, 29 domain/integration tests passed, and 12 browser tests passed (including current booking/payment/inventory workflows and no-JavaScript public HTML). Additional owner-content and redirect coverage is included in `tests/seo.e2e.ts`.

Local production HTTP samples (three requests each, localhost, no mobile network simulation): homepage 10.8–23.1 ms / 52,010 HTML bytes; catalogue 14.7–26.6 ms / 74,154 bytes; camera category 10.7–17.8 ms / 26,636 bytes; contact 5.9–12.2 ms / 12,899 bytes. These are full-response lab timings before the final navigation adjustment, not hosted latency, Lighthouse scores or real-user Core Web Vitals. Browser checks verify no mobile horizontal overflow. No Search Console, Google indexing, remote DNS or GBP verification has been performed.

Final verification after navigation and draft-visibility changes: `npm run build` passed; `npm test` ran 29 tests with 29 passed; `NEXTAUTH_URL=http://localhost:3000 npm run test:e2e` ran 13 tests with 13 passed. Owner content editing, permanent guide redirects, hidden drafts, SSR/no-JavaScript content, canonicals, JSON-LD, 404s and current customer/staff financial workflows all passed. `git diff --check` passed. No deployment or push to the production branch was performed.

## Deployment review — 29 October 2026

Release was subsequently authorized by the user. Review fixed podcast-only navigation, empty/whitespace publication fields, collisions with built-in template URLs and protection against exceeding the slug-alias limit. Production build passed and 30 backend tests passed. All four SEO/landing browser checks passed again after these fixes; the full 13-test browser suite passed before the final review fixes. Remote verification at camnova.onrender.com is blocked by this workspace's outbound proxy (CONNECT HTTP 403), so a successful GitHub push triggers the existing Render workflow but does not by itself verify a completed live deployment. Confirm the deployment's source commit and Live status in Render before declaring the release live.
