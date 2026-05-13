# Architecture — Nidham Enterprise Edition

## Component diagram

```
                  ┌────────────────────────────────────┐
                  │           Customer's LAN           │
                  │                                    │
   ┌────────┐     │    ┌────────────────────────┐      │
   │ HR PC  │────────► │     Server box         │      │
   │ Chrome │     │    │     (Windows)          │      │
   └────────┘     │    │                        │      │
                  │    │  ┌──────────────────┐  │      │
                  │    │  │  Docker Compose  │  │      │
                  │    │  │                  │  │      │
                  │    │  │  ┌────────────┐  │  │      │
                  │    │  │  │   Kong     │  │  │      │
                  │    │  │  │  :8000     │  │  │      │
                  │    │  │  └─┬───────┬──┘  │  │      │
                  │    │  │    │       │     │  │      │
                  │    │  │ ┌──▼──┐ ┌──▼──┐  │  │      │
                  │    │  │ │auth │ │rest │  │  │      │
                  │    │  │ │9999 │ │3000 │  │  │      │
                  │    │  │ └──┬──┘ └──┬──┘  │  │      │
                  │    │  │    └───┬───┘     │  │      │
                  │    │  │   ┌────▼────┐    │  │      │
                  │    │  │   │   db    │    │  │      │
                  │    │  │   │  :5432  │    │  │      │
                  │    │  │   └─────────┘    │  │      │
                  │    │  │                  │  │      │
                  │    │  │  ┌────────────┐  │  │      │
                  │    │  │  │ Nidham App │◄─┼──┼──────┤
                  │    │  │  │   :3000    │  │  │      │
                  │    │  │  └────────────┘  │  │      │
                  │    │  └──────────────────┘  │      │
                  │    └────────────────────────┘      │
                  └────────────────────────────────────┘
                                  │
                                  │ (only AI screening, optional)
                                  ▼
                          ┌──────────────┐
                          │ Google       │
                          │ Gemini API   │
                          └──────────────┘
```

## Services

| Service | Image | Role | Internal port | Exposed |
|---|---|---|---|---|
| `db` | `supabase/postgres:15.1.1.78` | PostgreSQL + auth/storage schemas pre-installed | 5432 | 5432 (for backups) |
| `auth` | `supabase/gotrue:v2.158.1` | JWT-based authentication | 9999 | — |
| `rest` | `postgrest/postgrest:v12.2.0` | REST API over `public` schema | 3000 | — |
| `kong` | `kong:2.8.1` | Routes `/auth/v1/*` → auth, `/rest/v1/*` → rest, enforces apikey | 8000 | **8000** |
| `app` | locally built from `Dockerfile` | Next.js standalone server | 3000 | **3000** |

## Why this exact shape

The cloud SaaS uses Supabase, which under the hood is the same four
services above (GoTrue, PostgREST, Kong, Postgres). By running the same
stack locally we get **zero code changes** in the Next.js app — the only
difference between cloud and Enterprise is the value of
`NEXT_PUBLIC_SUPABASE_URL` (cloud hostname vs `http://localhost:8000`).

Other approaches we ruled out:

- **Bare Postgres + NextAuth**. Would require rewriting every `createClient()`
  call and reimplementing every RLS-aware query. ~3 weeks of work to gain
  nothing the customer perceives.
- **Bundling all of Supabase (Studio, Realtime, Edge Runtime, Vector,
  Analytics)**. 7+ extra containers, ~3 GB heavier, none of them used by
  Nidham. Excluded.

## Data flow — public job application

The most complex path is a candidate applying via the public portal. Walk
through what happens server-side:

1. **Anonymous visitor** hits `http://<server>:3000/jobs/[slug]/apply` —
   served by the Next.js app.
2. Submits the form → invokes server action `submitPublicApplication`.
3. The action parses the PDF in-process with `pdf-parse`, then calls
   `supabase.rpc("submit_public_application", ...)` against
   `http://kong:8000/rest/v1/rpc/submit_public_application`. The Supabase
   client attaches `apikey: <ANON_KEY>`.
4. Kong validates the apikey, forwards to PostgREST as the `anon` role.
5. PostgREST calls the `submit_public_application` Postgres function —
   `security definer` — which writes a row in `candidates` and one in
   `applications`, returning the new application id.
6. The action calls Gemini with the CV text (the only outbound call) and
   persists the AI verdict via two more RPCs.
7. Redirects the visitor to `/jobs/applied/[id]`.

No data leaves the LAN except the CV text sent to Gemini, and only when
the AI feature is enabled.

## RLS posture

The migrations are identical to the cloud version. Every table has
`company_id` + tenant-scoped policies. The public portal works because
`014_audit_fixes.sql` added two narrow public-read policies (companies
that have a public+open job, and the `public_jobs` view).

Super admins (recorded in `super_admins`) bypass tenant scoping for SELECT
on every Nidham table — useful when the SaaS owner ships an update and
needs to inspect the customer's database remotely with consent.

## Upgrade path

Day-to-day a customer runs the same images. To pick up a new Nidham version:

```powershell
cd C:\nidham
git pull                          # or replace the folder from a new release zip
docker compose build app          # rebuild only the changed service
docker compose up -d app
powershell scripts\apply-migrations.ps1   # idempotent — only new SQL runs
```

`_nidham_migrations` tracks which files have already been applied; the
runner skips them on subsequent invocations.

## Security checklist (Phase 0)

- [x] JWT secret is randomly generated per install (48 chars)
- [x] Postgres password is randomly generated (32 chars)
- [x] ANON_KEY and SERVICE_ROLE_KEY are signed locally — never shipped
- [x] RLS enforced on every tenant table
- [x] Public RPCs are `security definer` with explicit row validation
- [x] No service-role key is ever exposed to the browser
- [ ] HTTPS termination — Phase 1 will add Caddy/nginx in front
- [ ] License key gating — Phase 2

## Phase 1 (next) — Desktop client

Wrap the same web UI in Electron so HR machines get a real `.exe` installer
and a Start-menu icon. The Electron shell will:

- Take the server URL as a config (first-run prompt)
- Auto-update when the SaaS-side ships a new shell
- Add an offline grace banner when LAN goes down

## Phase 2 — Licensing

A small license-server we run on `nidham.com` will hand out signed keys
tied to a company name + seat count + renewal date. The Enterprise app
validates the key once a week against the license server (with a 7-day
offline grace) and refuses to start past the renewal date.
