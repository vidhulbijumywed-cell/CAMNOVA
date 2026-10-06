# Free-first CAMNOVA deployment

Run the internal rental app on **Render Free** with a **Neon Free PostgreSQL** database. Start at the HTTPS `.onrender.com` address assigned by Render. Buying a domain is unnecessary for this first deployment, and your Mac does not need Docker or need to stay running.

The configuration in this repository prepares deployment; it does not create accounts, provision services, or make the app live. Keep every resource on its free plan. `camnova.app` is a proposed future domain: availability and registration price have not been verified, and nothing has been purchased.

## Create the free database

Sign in to Neon, create a project on the **Free** plan, and choose a region close to the Render service. Keep its PostgreSQL database independent of the web service so redeploying the application retains bookings.

In Neon's connection details, select the **direct (non-pooled) connection URL** for your database. Copy it into Render's private `DATABASE_URL` setting when prompted during deployment. Use verified PostgreSQL TLS (`sslmode=verify-full`); replace `sslmode=require` with `sslmode=verify-full` if present. Do not disable certificate verification. The URL contains a password: keep it out of GitHub, screenshots, and chat messages. Do not use the local `camnova_local_only` password online.

Do not create a Render Free PostgreSQL database for this app: those databases expire. This setup uses external Neon Free instead.

## Create the free web service

Open [Deploy CAMNOVA on Render](https://render.com/deploy?repo=https://github.com/vidhulbijumywed-cell/CAMNOVA), sign in or create a Render account, and connect GitHub if prompted. The blueprint reads `render.yaml` from repository `vidhulbijumywed-cell/CAMNOVA`, branch `main`. Review that it contains only one native **Node web service** with **Free** instance type, then supply your Neon URL as `DATABASE_URL` and start deployment. The blueprint provisions no database and no paid resource or custom domain. Node.js **24** is selected in `.node-version` and `package.json`.

Use this build command:

```bash
npm ci --include=dev && npm run db:generate && npm run build
```

The explicit `--include=dev` matters: the build uses TypeScript/Tailwind, and deployment migrations/seeding use Prisma and tsx from `devDependencies`. Do not prune them before those commands run.

The blueprint sets these values in Render's private environment settings:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | You supply your direct Neon PostgreSQL URL, using verified TLS |
| `NEXTAUTH_SECRET` | Render generates a random secret; retain it across deployments |
| `SEED_ADMIN_EMAIL` | `owner@example.test`, or your preferred owner email before the first seed |
| `SEED_ADMIN_PASSWORD` | Render generates a random owner password |
| `SEED_STAFF_EMAIL` | `staff@example.test`, or a different staff email before the first seed |
| `SEED_STAFF_PASSWORD` | Render generates a separate random staff password |
| `SEED_DEMO` | `false` |

Retrieve your generated owner/staff passwords privately from the service's **Environment** settings in Render. The default email addresses are login identifiers; the app does not send email. Do not share or commit the passwords. For a manual service setup, generate an authentication secret locally with `openssl rand -base64 48`, retain it as `NEXTAUTH_SECRET`, and choose separate account passwords of at least 12 characters. Avoid `npm run env:init` on the host: that helper is for local defaults.

Use this start command (already set by the blueprint):

```bash
bash scripts/deploy-start.sh
```

The script validates the production settings, waits for PostgreSQL, applies the committed Prisma migrations, seeds initial accounts/inventory, and then runs `npm start`. Migrations and the initial seed must succeed before accepting requests. The seed preserves existing accounts and bookings; changing seed passwords later does not reset account passwords.

The deployment startup wrapper uses Render's assigned HTTPS address as `NEXTAUTH_URL` unless you explicitly configure that variable. The exact origin matters for login and for saving bookings. Keep `NEXTAUTH_URL` unset for the first hosting-assigned address; set it to the final HTTPS origin when adding a custom domain. The service uses Render's supplied `PORT`.

## Verify and keep records safe

Open the HTTPS address shown in Render after deployment succeeds. Sign in using the owner email/password from your private environment settings. Confirm equipment inventory is present and fictional demo bookings are absent. Create a clearly labelled test booking, verify it survives a service restart, then cancel it through the app to retain an audit trail.

Render Free services can sleep when idle, so the first request may take longer. Free app/database plans have usage limits; check the provider dashboards before relying on them for daily operations. Review the price and limits before enabling any paid feature. No custom domain registration is included in the free hosting address.

For business records, schedule private database exports to storage outside the app host and test restoration into a separate database. Managed database persistence and free retention features are not a substitute for an independent backup. The repository's `npm run db:backup` script targets local Docker only; use the database provider's export/backup tools or `pg_dump` for Neon. Never add backup files to GitHub.

## Add a new custom domain later

Register an available domain in an account you control once you approve its annual registration and renewal costs. For example, if you acquire `camnova.app`, the internal app could use `admin.camnova.app` while the main domain remains available for a customer website. This is an example, not an availability claim. `camnova.admin.in` would require control of `admin.in`, since it is a subdomain.

Add the chosen hostname to Render's custom-domain settings. At the registrar, enter the **exact DNS record type, name, and target Render provides**; do not guess a CNAME or IP address. Wait for Render to verify the hostname and issue its HTTPS certificate.

Set `NEXTAUTH_URL` to that hostname's full HTTPS origin, without a path, then redeploy and repeat login/booking-save verification. Keep `NEXTAUTH_SECRET` and the existing `DATABASE_URL` unchanged so the same accounts and rental records remain available. Use the canonical configured hostname when signing in and saving changes.
