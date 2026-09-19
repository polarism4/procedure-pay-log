Procedure Pay Log v0.7 PWA

Deploy:
1) Upload every file in this folder to a static host (Cloudflare Pages / GitHub Pages / Netlify).
2) Open the HTTPS URL in Safari on iPhone.
3) Share -> Add to Home Screen.

Data:
- Stored locally in the browser/app using localStorage.
- Use Prices -> Backup data (.json) regularly.
- Restore Backup can restore both entries and prices.
- Do not clear Safari website data unless you have a backup.

v0.7 procedure management:
- Rename a procedure.
- Optionally rename historical records too.
- Hide/unhide procedures from new entry.
- Delete unused procedures permanently.
- If a procedure already exists in History, Delete safely converts it to Hidden so history is preserved.

v0.7 quick price controls:
- Main minus/plus buttons change price by 100 THB.
- Quick buttons: -500, -100, +100, +500 THB.
