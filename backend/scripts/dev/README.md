# Dev tooling scripts

These scripts are for **local development only** — never run them against production
without reading them fully first. None of them are invoked automatically by the app,
`npm start`, or CI; they are manual, human-run CLI tools.

- **`generateSecret.js`** — prints a random secret suitable for `JWT_SECRET`. Referenced
  from `server.js`'s startup check and `.env.example`.
- **`fullSeed.js`** — bootstraps a full local dev database (gyms, plans, members, etc.)
  from scratch. Destructive on the target DB — only run against a local/dev database.
- **`seed-operations.js`** — seeds operational data (attendance, payroll, etc.) for a
  dev environment.
- **`seed-fitpass-gyms.js`** — seeds sample FitPass partner gyms for local testing.
- **`seed-reviews.js`** — seeds sample gym reviews for local testing.
- **`seed-showcase.js`** — adds H4 and FitPass gyms, branches, members, staff accounts,
  plans, attendance, payments, and expenses to the configured database. Re-running it
  updates its known accounts and avoids duplicate payment/attendance/expense rows.
  Run with `npm run seed:showcase` from `backend/`. It is additive; a full database
  reset removes these rows along with everything else in that database. Staff login
  credentials are printed once by the command; member passwords are their phone numbers.

## What used to live here

A number of one-off, single-use scripts (data fixes for specific named users/records,
ad-hoc DB inspection scripts, manual QA runners) previously lived in `backend/scripts/`
directly. They were removed because they hardcoded real record IDs/names, were never
meant to be reused, and one of them reset every partner admin's password to a shared
plaintext value — a real security liability if it were ever re-run. If you need to do a
one-off data fix again, write a throwaway script locally and do not commit it; if a
similar fix becomes a recurring need, promote it to a proper reusable tool here instead.
