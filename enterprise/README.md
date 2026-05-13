# Nidham Enterprise Edition

Self-hosted, single-server deployment of the Nidham HR + CRM + AI Recruitment
platform for companies that need their data on-premise.

The **same product** as the cloud SaaS — same UI, same modules, same
migrations — bundled to run on a Windows or Linux box inside the customer's
network. No Vercel, no Supabase Cloud, no external database. The only
outbound call is to Google Gemini for CV screening (and only when the AI
feature is exercised).

## What's in here

| Path | Purpose |
|---|---|
| `docker-compose.yml` | The full stack — Postgres, GoTrue, PostgREST, Kong, the Next.js app |
| `Dockerfile` | Multi-stage build of the Next.js app (~80 MB final image) |
| `kong/kong.yml` | API gateway config that fronts `/auth/*` + `/rest/v1/*` |
| `migrations/` | The 14 Nidham SQL migrations, applied at install + on upgrade |
| `scripts/install.ps1` | One-shot installer for Windows |
| `scripts/generate-keys.mjs` | Generates POSTGRES_PASSWORD, JWT_SECRET, ANON + SERVICE_ROLE keys |
| `scripts/apply-migrations.ps1` | Idempotent migration runner (tracks applied files in `_nidham_migrations`) |
| `scripts/start.ps1` / `stop.ps1` | Lifecycle helpers |
| `scripts/backup.ps1` / `restore.ps1` | Daily pg_dump → .sql.gz, restore from a .sql.gz |
| `INSTALL_AR.md` | Customer-facing install guide in Arabic |
| `docs/architecture.md` | Component diagram + data flow for support engineers |
| `.env.example` | Template for the runtime config |

## Quick start (development box)

```powershell
cd enterprise
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

The installer:
1. Checks Docker Desktop + Node are installed
2. Copies `.env.example` → `.env` if missing
3. Generates JWT keys via `scripts/generate-keys.mjs`
4. `docker compose up -d --build` — builds the app + pulls 4 service images
5. Waits for Postgres to be healthy
6. Applies all 14 migrations through `apply-migrations.ps1`
7. Prints the URLs to open

Total time on a clean machine: ~10 min the first run, ~30 sec on subsequent
starts.

## Lifecycle

```powershell
# Start / stop
powershell scripts\start.ps1
powershell scripts\stop.ps1

# Daily backup (suggested as a Scheduled Task at 03:00)
powershell scripts\backup.ps1

# Restore a specific backup
powershell scripts\restore.ps1 -BackupFile backups\nidham-20260513-030000.sql.gz

# Re-apply new migrations after an upgrade
powershell scripts\apply-migrations.ps1
```

## What's NOT in Phase 0 (planned)

- [ ] **Electron desktop client** — Phase 1. The customer's HR machines today
      open the app in a browser at `http://<server-ip>:3000`.
- [ ] **License key system** — Phase 2. Currently the install is unlimited;
      seat enforcement comes later.
- [ ] **Windows installer (.msi)** — Phase 2. Today the install is a folder
      copy + PowerShell script.
- [ ] **Auto-update channel** — Phase 2. Today upgrades are a `git pull` +
      `docker compose up -d --build`.

See `docs/architecture.md` for the technical design and trade-offs.
