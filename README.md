# Procedure Pay Log v1.0 — database integration

Prepared from `polarism4/procedure-pay-log` main (original index blob `97eac20093d85fc865562b84e5b2c2e552c598e4`). Keeps the existing mobile layout, quick-entry workflow, `sss` = ปกส. and `private` = ทั่วไป/ประกัน, history, procedure management, CSV, and JSON backups.

## Deploy

1. Create a Supabase project. Run `supabase/schema.sql` once in its SQL Editor against a new database. The transaction creates three tables, RLS policies and two RPC functions. Do not rerun over an existing schema; future schema changes should be versioned migrations.
2. Create your first user in Supabase Authentication → Users. The UI supports email/password sign-in for existing users. Self-signup and password recovery screens are outside this increment; manage users from Supabase initially.
3. In Cloudflare Pages configure build command `node build.cjs`, output directory `dist`, and environment variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Use the project URL and publishable key (or legacy anon key). Never use a secret/service-role key. Configure preview variables separately, preferably pointing to a staging Supabase project.
4. Deploy a preview first and complete the checks below. No Cloudflare-specific server runtime is needed. The build copies only public assets; SQL, tests, docs and environment files are excluded.
5. Open Prices → บัญชีและ Cloud. Sign in, then explicitly import the old local data into an empty account. Keep the same origin as the old app to access its localStorage. A new domain or a different iPhone web-app container needs JSON backup/restore first.

Without variables the build remains a working local-only PWA. `config.js` in source intentionally has blank public configuration; the build generates the deployed version from environment variables. The optional auth SDK is pinned to Supabase JS 2.102.0 via esm.sh and needs network access on first sign-in.

## Migration from v0.x

1. On every device, export a JSON backup from the old app and keep it outside browser storage. Note entry count and monthly totals for each coverage type. Close other old app tabs during upgrade.
2. The application reads `proc_entries_v04` / `proc_prices_v04`, with fallbacks to v03, v02 and unversioned keys. Guest data is retained after cloud sign-in.
3. Sign into the intended account. The cloud account is shown independently of guest data; data is never uploaded merely by signing in.
4. Choose “นำเข้าข้อมูลเดิมจากเครื่อง”. Import is allowed only into an empty account at revision zero. A pre-import snapshot is stored as `proc_pre_cloud_backup_v1`; original guest keys remain intact. Invalid dates, duplicate IDs, unknown coverage, bad prices and mismatched totals stop import.
5. Confirm the count. The importer preserves IDs (numeric IDs become strings), timestamps, notes, historical names, prices and hidden state. New entries use UUIDs. Database totals are generated from quantity × unit price.
6. Wait for “ซิงก์แล้ว”. Load from Cloud, then compare counts and totals against the external backup. Sign into a second device and load the same account to verify.
7. Do not import another device's overlapping snapshot automatically. Repeated import into a populated cloud account is blocked. Reconcile differing backups before import; this increment deliberately does not guess which financial records are duplicates.

## Synchronization and account isolation

Each local edit persists immediately in an account-specific pending snapshot. One atomic database RPC replaces that account's catalog and entries only if its revision still matches. The database row lock serializes writers. A failed request leaves the pending snapshot intact. Retries after an uncertain successful response yield a conflict rather than duplicate rows.

Other devices see current data on first sign-in without a cache, or by tapping “โหลดจาก Cloud”. Cached accounts open their cached snapshot and should refresh to see remote changes. There is no realtime/background polling in this increment. A stale write is rejected, never silently merged. Export a backup before loading cloud data over pending changes; the app also retains a `_before_reload` recovery snapshot. For a real conflict, reconcile local changes against the downloaded cloud version before re-entering them.

Writes during an in-flight save remain pending and are sent next. Mutations are blocked during sign-in, sign-out and cloud reload. Sign-out clears the active clean account cache and returns to the preserved guest data. Unsynced data must be synced or explicitly reconciled before sign-out.

Sessions are memory-only: reload requires sign-in. Offline edits work while an authenticated session remains open; reopening offline supports guest mode, and the pending account snapshot becomes available after signing in online. Account caches/backups are browser-local, not encrypted storage; use the app on a trusted device. This is a first-version snapshot sync protocol suitable for a personal log; large datasets should move to paginated incremental operation sync.

## Data model

- `procedure_types`: per-user catalog keyed by name, prices for both coverages, active flag.
- `procedure_entries`: per-user entry ID, performed timestamp, historical procedure name and unit-price snapshots, coverage, quantity, generated total, note. Deliberately no name foreign key: a catalog rename/hide must preserve historical records unless the user explicitly chooses to rename history too.
- `app_settings`: per-user revision, default coverage reserved for future UI preferences, update timestamp.

Authenticated users can read only their own rows. Anonymous users have no table privileges. Direct client writes are revoked; the write RPC derives ownership exclusively from `auth.uid()`, validates constraints and locks the revision. Its security-definer search path is empty. The read RPC uses invoker permissions and one consistent statement, avoiding REST pagination truncation.

## Validation

Run `node --test tests/*.cjs` and `node build.cjs` (no install needed). Eight automated tests cover legacy conversion, both coverages, invalid/duplicate imports, historical names, hidden procedures, stale revisions, offline failures, account cache isolation and changes made during an in-flight save. JavaScript syntax and an unconfigured build were checked.

Live database execution, actual login, Cloudflare deployment and mobile Safari visual testing have not been performed: no Supabase project credentials or deployment target were supplied. Before production:

- Apply SQL to staging; use two separate users to verify A cannot read/write B, anonymous access fails, concurrent saves reject a stale revision, and invalid payloads roll back without changing existing data.
- Check add/edit/delete and rename-with/without-history, hidden procedures, two rapid save taps, decimal pricing, exports, valid/invalid restores and a populated-account import attempt.
- On iPhone Safari, test existing PWA upgrade, navigation, airplane-mode edits while signed in, reconnect/retry, reload, logout and account switch. Close old tabs and reopen after the service worker update; check v1.0 is visible.
- Compare first migration's monthly totals and entry counts on two devices before removing any external backups.

## Rollback

Keep the v0.7 deployment and external JSON backup. Reverting frontend code alone shows the unchanged guest dataset, which does not include later cloud edits. Export cloud JSON first and restore it into the local app if rolling back. Preserve database rows while investigating; do not drop the schema as a rollback step.

References: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
