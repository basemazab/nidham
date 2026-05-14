# Marketing Screenshot Generator

Captures full-page PNGs of every key Nidham page in **desktop** (1920×1200)
and **mobile** (390×844) viewports. The output goes under
`public/marketing/screenshots/` so Vercel serves them as static assets at:

```
{NIDHAM_BASE_URL}/marketing/screenshots/desktop/{name}.png
{NIDHAM_BASE_URL}/marketing/screenshots/mobile/{name}.png
{NIDHAM_BASE_URL}/marketing/index.json
```

## Pages captured

| # | Name | Path |
|---|---|---|
| 01 | overview | `/dashboard` |
| 02 | employees-list | `/dashboard/employees` |
| 03 | ai-pdf-import | `/dashboard/employees/import` |
| 04 | attendance-gps | `/dashboard/attendance` |
| 05 | payroll | `/dashboard/payroll` |
| 06 | payslip | `/dashboard/payroll/{first-period}` |
| 07 | requests | `/dashboard/requests` |
| 08 | crm-pipeline | `/dashboard/customers` |
| 09 | jobs-ats | `/dashboard/jobs` |
| 10 | ai-cv-screening | `/dashboard/jobs/{first-job}` |
| 11 | bridge-analytics | `/dashboard/reports/bridge` |
| 12 | ai-assistant | `/dashboard/ai` |

Pages 06 and 10 resolve dynamic IDs from the listing page, so the
account you log in with must have **at least one payroll period and one
job** in its tenant.

## Setup (one-time)

```bash
# From repo root
cp scripts/.env.local.example .env.local
# then edit .env.local with NIDHAM_EMAIL, NIDHAM_PASSWORD, NIDHAM_BASE_URL

# Make sure Chromium is downloaded (re-running is a no-op)
npx playwright install chromium
```

## Run

```bash
npm run screenshots
```

Behaviour:

1. Launches headless Chromium.
2. Logs in once and saves the session to `scripts/storageState.json`
   (git-ignored).
3. Walks the 12 pages × 2 viewports.
4. Before every screenshot:
   - Waits for `networkidle`.
   - Injects CSS that disables all animations / transitions.
   - Removes any toast / alert / Beta banner.
   - Waits another 800 ms so layout settles.
5. Writes the PNG + a `public/marketing/index.json` manifest with the
   exact public URLs each PNG will get after `git push`.

## Publish

The PNGs are static assets under `public/`, so they ship with the
next Vercel deploy:

```bash
git add public/marketing
git commit -m "marketing: refresh product screenshots"
git push
```

Wait 2–3 min for Vercel to deploy, then `index.json` is live at
`{NIDHAM_BASE_URL}/marketing/index.json`. The script prints every URL
at the end of its run.

## Troubleshooting

- **"resolver returned null"** — the account has no payroll periods or
  jobs to deep-link into. Create one in the UI or seed demo data, then
  re-run.
- **Login fails** — verify the email/password against the same
  deployment URL. If the deployment requires Vercel SSO, switch to a
  deployment that has password auth open.
- **Blank screenshots** — your account might land on an onboarding
  redirect. Click through it once in the browser, then re-run.
- **Stale session** — delete `scripts/storageState.json` and re-run; a
  fresh login will be performed.
