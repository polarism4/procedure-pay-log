# Procedure Pay Log v1.1 — production handoff

## Cloudflare Workers Static Assets

Use these Cloudflare Workers Builds settings:

- Root directory: `/`
- Build command: `node build.cjs`
- Deploy command: `npx wrangler deploy`
- Build variable: `SUPABASE_URL`
- Build variable: `SUPABASE_PUBLISHABLE_KEY`

`wrangler.jsonc` points Workers Static Assets at `./dist`. The build copies only browser assets into `dist` and generates `dist/config.js` from the two public build variables.

Do not use a Supabase `service_role` key or `sb_secret_...` key. The build rejects obvious secret keys.

## Supabase first-time setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql` once against a fresh project.
3. In Authentication → Users, create the first email/password user.
4. In Cloudflare Workers Builds, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
5. Trigger a new deployment.
6. Open the app → Prices → บัญชีและ Cloud → sign in.
7. Guest data remains separate. Use “นำเข้าข้อมูลเดิมจากเครื่อง” only when you intentionally want to migrate it.
8. Migration is blocked if the cloud account is populated. Before migration the app keeps a browser-local snapshot and downloads a JSON pre-cloud backup.

## Tests

Run:

```bash
node --check cloud.js
node --check data.js
node --check service-worker.js
node --check build.cjs
node --test tests/*.cjs
node build.cjs
```

The recreated regression suite covers legacy IDs/timestamps, both coverage types, invalid totals, duplicates/malformed entries, hidden and historical procedures, guest/account isolation, stale clean caches, dirty-cache retry, network failures, revision conflicts, in-flight edits, and SQL security invariants.

## Notes

Sessions persist in browser local storage, refresh automatically and restore the last signed-in account when the app reopens. Explicit sign-out removes the saved session. Pending account data remains in an account-specific localStorage cache and retries automatically after session restoration.

The application retains full DF and derives actual payment per entry: `sss` = 50%, `private` = 80%. Legacy entries are normalized with these rates; dashboard/history/CSV show both values. No database migration is required because actual payment is deterministically reconstructed from the stored coverage and full DF.

The service worker is network-first for the app shell only, does not intercept Supabase/auth/external requests, calls `skipWaiting()` and `clients.claim()`, and deletes older `procedure-pay-log-*` caches on activation.
