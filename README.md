# CAMNOVA Rentals

An authenticated rental operations workspace built from the supplied CAMNOVA tracker and brand guide. Next.js, TypeScript, Tailwind, PostgreSQL, Prisma, NextAuth, ExcelJS, pdf-lib, and Recharts.

To host the internal app without buying a domain first, follow [Free-first deployment](DEPLOYMENT.md): Render Free for the Node.js app and Neon Free for persistent PostgreSQL. Start with the hosting-assigned HTTPS address; a custom domain can be connected later.

The supplied logo was extracted directly from the PDF. Brand accents use CAMNOVA red (#ed1a3a), black, white, and the guide’s secondary palette. ITC Eras was not supplied as a licensed font asset, so headings use Inter as the documented fallback.

## Start locally

Requirements: Node.js 24, npm, and Docker with Docker Compose. The environment already contains these tools. Use the existing checkout; cloud tasks are isolated and do not need a Git worktree.

```bash
cd /workspace/CAMNOVA
npm run setup
npm run dev
```

`setup` installs the frozen lockfile, creates an ignored `.env` only if absent, starts PostgreSQL, generates Prisma, applies committed migrations, and seeds inventory. `.env` contains randomly generated local owner/staff passwords, never printed or committed. Sign in as `owner@example.test` using `SEED_ADMIN_PASSWORD` from that local file. Staff uses `staff@example.test` and `SEED_STAFF_PASSWORD`. The initial seed never overwrites existing passwords.

For a conventional machine, use its checkout directory instead of `/workspace/CAMNOVA`. The npm cache is local and ignored. To supply your own initial credentials, copy `.env.example` to `.env` and edit it securely before setup. `SEED_DEMO=true` creates eight fictional bookings on an empty database; set it to `false` for a real business database. The 42 equipment models and their listed rates/purchase costs come from the attached Rate Card. No real customers are included in seeds.

For an existing or managed PostgreSQL database, set `DATABASE_URL` securely, skip the Docker/setup shell script, then run:

```bash
npm ci --include=dev
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Set `SEED_DEMO=false`, strong initial passwords, a random `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` to the deployed HTTPS origin. Use PostgreSQL TLS with verified certificates for remote databases. Never deploy the local Compose password as a production credential. Retain `NEXTAUTH_SECRET` between server restarts; rotating it invalidates sessions. Business settings and team access are available to the owner only.

## Working in the app

## Customer portal

Share `/rentals` on the deployed CAMNOVA domain with customers. The storefront uses real inventory, daily rates, model photos and date-based availability, including maintenance, overdue rentals, partial returns and turnaround time. Pickup and return inputs use IST. Customers can search/filter the catalogue, create an email/password account at `/customer/login`, choose quantities and send a rental request. Unpriced items remain “Rate on request”; estimates follow the configured rental-day policy.

Customer requests appear as **Draft** bookings in the existing staff workspace, with a source note. Drafts do not hold stock; staff must review, price and confirm them, and confirmation rechecks capacity. Customers see only their own portal requests and updated booking statuses. Customer credentials cannot access staff APIs, exports, customer lists or workspace settings. New registrations create a separate customer identity and never claim historical records by matching an unverified email. Reassigning a portal booking to a different customer removes its portal access link.

The supplied storefront prototype informs the design and hero images; its hardcoded stock, discounted combos, font and contact details are not used as live business data. Customer photos in the catalogue are public. No new service key or storage account is required. Deploy with `npm ci --include=dev && npm run build` and `bash scripts/deploy-start.sh`; startup applies the additive customer-account migration before serving requests. Email verification, self-service password recovery, online payments and configurable combo pricing are not part of this first version. Customer passwords are hashed; sign-in and registration are throttled.

## Staff workspace

- **Dashboard:** monthly booking revenue, collection balances, weekday chart, upcoming rentals, and recent bookings.
- **Bookings:** create drafts, choose customer and equipment, confirm dates, enter negotiated pricing, and record payments independently. Booking references remain stable after sorting. Owner can edit confirmed financial records; staff can create bookings and manage operational checklists.
- **Calendar:** pickup/return dates and active reservation details. Availability uses the full rental interval, quantity, maintenance capacity, turnaround buffer, and overdue equipment still out with customers.
- **Inventory:** model rates and units, individual asset serials, purchase details, condition, accessories, maintenance, and retirement. Serial/purchase dates stay blank when unknown. Availability is model/quantity based; staff must select physical units at handover. The asset state “in rental fleet” indicates serviceability; current rental usage comes from reservations.

Owners can add one product photo when creating equipment or through **Inventory → select a model → Edit model / add units → Product photo**. JPG, PNG, and WebP uploads up to 10 MB are resized to at most 1600 pixels and converted to JPEG before saving (maximum stored size 1 MB). Preview, replacement, and removal are supported. Photos appear on inventory cards and equipment details for authenticated owners and staff. They are stored in PostgreSQL, so Neon retains them across Render redeployments; no extra storage service or API key is needed. Database backups include photos. Keep database storage usage in mind for larger catalogs.
- **Customers:** multiple phone numbers, raw historical phone text, referrals, notes, booking history, and outstanding amounts.
- **Collections:** all unpaid confirmed bookings, oldest first, due dates, follow-up notes, and split payments. No spreadsheet row limit.
- **Vendors:** multiple outsourced lines per booking, agreed costs, and actual vendor payments.
- **Reports:** booking-date cohorts and payment-date cash flow, with exports for the selected month. Refundable deposits are excluded from rental revenue.
- **Settings:** business details, invoice prefix, rental-day policy, turnaround time, payment-mode cutoff, WhatsApp templates, team management, audit trail, and import history.

Open a booking to record rental/deposit payments, refunds, or corrections; download summaries, quotations, invoices, and individual receipts; check equipment out/in; extend its rental; or open a prefilled WhatsApp message. Refunds, corrections, reviewed credits, cancellation, asset changes, and vendor payments require owner access. Automatic messaging and paid third-party services are not required.

Pickup and return actions require condition notes. Returns can be partial, and missing/damaged accessories can be recorded. Mark affected physical assets as maintenance before reserving them again. Extensions recheck capacity but keep the agreed total unchanged; no extra charge is invented. Staff cancellation is deliberately restricted because financial history must remain reviewable.

## Spreadsheet migration

Use **Bookings → Import workbook** as owner. The wizard previews rows, lets you map booking input columns, shows warnings/errors, and requires a selection before import. Rate Card mapping follows this workbook's fixed layout. Formula-only empty rows and totals are ignored. Source formulas are rejected rather than evaluated.

The supplied workbook contains **36 populated booking rows and 42 inventory entries**. Similar/duplicate bookings start deselected for explicit review. A file fingerprint prevents duplicate imports, including after rollback. Existing inventory names are skipped without changing rates or quantities. Customer records are preserved per source row rather than merged by name alone; review duplicate customer identities manually.

Imports map `Collected` to `Picked Up` and `Dropped` to `Returned`. Missing dates/equipment assignments are never fabricated. Historical bookings do not reserve inventory, and cumulative payments use an unknown payment date. Existing payment modes can remain “Not recorded” before the configurable cutoff (initially 1 October 2026). Missing rents are null, not zero. Historical returned bookings can be corrected while remaining historical; conversion to reservations needs structured equipment and real rental dates.

Safe rollback refuses to remove imported records with subsequent edits, payments, or dependencies. Import source-row references and original booking references remain visible. Imports do not silently combine multi-day bookings. CSV/XLSX exports escape spreadsheet formula injection. Uploads are limited to 10 MB compressed and 100 MB expanded, with per-entry/row limits.

To verify a workbook privately from the command line:

```bash
npm run check:workbook -- /absolute/path/to/tracker.xlsx
```

This creates a separate disposable database, imports and checks record counts, confirms duplicate rejection, rolls back, and drops the check database. It prints counts only. It never imports real customer records into the demo database or commits them to source control.

## Calculation rules

Money is stored as integer paise, including historic spreadsheet currency strings. The payment ledger stores signed movements: positive receipts, negative refunds, and auditable reversal/replacement pairs for corrections. Corrected cash-flow reporting restates effective payments; it does not invent refund movements for data-entry corrections.

Default duration: each started 24-hour period, minimum one day. The alternative is inclusive IST calendar days. Line prices are snapshotted at booking time. Calculated total = sum(quantity × daily rate × days) + agreed outsource costs − discount. A negotiated override replaces that total explicitly; it is useful for packages and outsourced markup. Existing bookings retain original rates when rate-card prices change.

Monthly booked revenue and collected-against-bookings use the booking date in IST; drafts and cancellations are excluded. Outsource costs are retained even for cancellations. Cash flow instead uses known payment/refund dates, includes movements on cancelled bookings, and excludes unknown historical dates. Payments and refundable security deposits are separate. A reviewed excess rental payment appears as a customer credit rather than an unpaid balance.

Maximum daily revenue uses priced, non-retired fleet units; monthly capacity multiplies by days in the selected month. Unpriced models are excluded with a warning. Revenue-capacity ratio is booked revenue / nominal monthly capacity; it is not actual equipment utilization. Illustrative payback is total recorded asset investment / monthly gross booked revenue, unavailable at zero revenue. Revenue after outsourcing does not subtract other operating expenses.

Actual utilization uses recorded pickup/return events and partial returns; historical free-text imports are excluded. Nominal unit-day capacity does not reconstruct historical acquisition or maintenance periods. The optional tax preference is informational on PDFs and never silently adds a charge. Business legal/contact/GST details and terms remain blank until configured. PDFs currently use INR text and a standard Latin font for body text; unsupported non-Latin characters are replaced with `?`. The web UI supports Unicode.

## Authentication and consistency

NextAuth credentials sessions use bcrypt hashes, signed HTTP-only JWT cookies, an eight-hour lifetime, login throttling, and server-side active-user/role checks on every protected request. Password changes and account disabling revoke prior sessions through a database session version. State-changing endpoints require the configured same-origin Origin header. Secrets and real customer data are not logged.

All inventory/booking/payment mutations acquire a PostgreSQL transaction-level advisory lock. Availability uses peak concurrent occupancy, not a sum of disjoint reservations. Payment updates are serialized to prevent simultaneous overpayment. Database checks protect quantities, asset/order states, and amounts. Optimistic booking versions reject stale edits. Audit entries record important actions without passwords. This is a single-business workspace; it is not a multi-tenant service.

Prisma Client 6.19 uses its JavaScript compiler and PostgreSQL driver adapter. CLI migrations use Prisma 6's experimental JavaScript/WASM schema engine with the pinned PostgreSQL adapter 7.10, which fixes the PostgreSQL catalog `name` type issue. This combination is locked and tested; preserve it or rerun the complete migration/concurrency suite when upgrading. No engine checksums or TLS verification are disabled. Native engine downloads are unnecessary for this configuration.

## Validation

```bash
npm run typecheck
npm test
npm run build
# With the application running and local seeded credentials in .env:
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Database tests create/use **camnova_test** exclusively and truncate only that disposable database. They test persistence after reconnect, split payments, concurrent reservations, peak overlap, cancellation, staff restrictions, partial returns, maintenance, overdue gear, extensions, refunds/credits/corrections, transactional imports/rollback, source validation, historical edits, turnaround buffering, exports, and PDFs. Browser tests create fictional acceptance records in the local development database; use a demo instance, not your live business database. Chromium is configurable through `CHROMIUM_PATH`; the cloud instance uses `/usr/bin/chromium`.

## Backup, restore, and deployment

Local development data survives app/database restarts in the named Docker volume `camnova_pgdata`. Docker volumes are not assumed to survive a fresh cloud machine.

```bash
npm run db:backup
```

This stores a private, ignored PostgreSQL custom-format dump in `.local/cloud-backup.dump`. Keep this file out of Git. The cloud setup script restores that retained backup only when the local database has no Booking table, then applies migrations. A snapshot contains prepared files/dependencies; running processes must restart. A new-task restoration must be checked independently before treating it as verified. For real business operations, use durable managed PostgreSQL and scheduled off-machine backups.

Restore to a **new database** first, verify counts, then switch `DATABASE_URL`. With the local container:

```bash
docker compose exec -T db createdb -U camnova camnova_restore_check
docker compose exec -T db pg_restore -U camnova -d camnova_restore_check --no-owner < .local/cloud-backup.dump
docker compose exec -T db psql -U camnova -d camnova_restore_check -c 'SELECT count(*) FROM "Booking"'
```

Do not overwrite a working database without preserving a separate backup. Backups include customer records and password hashes; store them privately.

To reset an existing account password, set `RESET_PASSWORD` through a secure shell/environment setting, then run `npm run user:password -- owner@example.test`. Never pass a password as a command-line argument or commit it. Editing SEED_ADMIN_PASSWORD after the first seed does not reset the existing account.

Deploy to a Node.js host with durable PostgreSQL: install with `npm ci --include=dev`, generate the client, run `npm run build`, then apply migrations before starting the app. The first deployment also needs `npm run db:seed` with `SEED_DEMO=false`. Keep the development dependencies available for Prisma/tsx release commands. Follow [the deployment guide](DEPLOYMENT.md) for free plans, HTTPS origin, secrets, and connecting a new domain. External messaging, customer self-service, identity-document uploads, online payment processing, and multi-tenant access are outside this internal-app scope. No external deployment or resource purchase is performed automatically.
