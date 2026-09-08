# Person 1 — Handoff Summary

## Project

**Study Room Reservation System (PBSE Week 3)**
A contract-first Express + SQLite backend for library study room reservations.

- **Workspace:** `D:\Rama Pratama\Codes\Cursor\study-reservation-pbse`
- **Branch:** `feature/database-infra`
- **Contract:** `openapi.yaml` (root of repo)
- **Assignment docs:** `Week 3/Tugas Kelompok week 3 pbse.docx` and `Week 3/TUGAS-P3_Kelompok-Implementasi-Kontrak.en.pdf` (in original Google Drive location)

---

## Person 1 Scope

**Role:** Database + App Infrastructure

### Owned files (ONLY touch these)

| File | Purpose |
|------|---------|
| `service/db/schema.sql` | All `CREATE TABLE` statements |
| `service/db/seed.sql` | Demo seed data |
| `service/db/init.js` | Script to rebuild DB from scratch (`npm run db:init`) |
| `service/.env.example` | Environment variable template |
| `service/src/app.js` | Express entrypoint, route assembly, error handler hookup, `/health` |
| `service/README.md` | Operation status table + deployment URL |

### Do NOT touch

`src/routes/`, `src/schemas/`, `src/store/`, `src/representations/`, `src/problem.js`

---

## What's Done

### ✅ Phase 1 — Schema (FROZEN 2026-09-03)

`service/db/schema.sql` — three tables, all `CREATE TABLE IF NOT EXISTS`:

- **`rooms`** — `id` (TEXT PK), `name`, `capacity` (CHECK > 0), `location`, `created_at`
- **`reservations`** — `id` (TEXT PK), `room_id` (FK → rooms), `date`, `start_time`, `end_time`, `status` (CHECK enum: `pending_checkin`, `checked_in`, `cancelled`, `no_show`, `completed`), `created_at`, `cancel_reason`, `cancelled_at`, `checked_in_at`. Indexes on `(room_id, date)` and `status`.
- **`idempotency_keys`** — `key` (TEXT PK), `request_hash`, `response_status`, `response_body`, `created_at`, `expires_at`. Index on `expires_at`.

Schema is **frozen** — no column changes without team agreement.

### ✅ Phase 2 — Seed Data

`service/db/seed.sql` — uses OpenAPI example IDs:

- 3 rooms: `rm_1a2B3cD`, `rm_2b3C4dE`, `rm_3c4D5eF`
- 4 reservations across different statuses: `rsv_9X8y7Z` (pending_checkin), `rsv_Aa1Bb2` (checked_in), `rsv_Cc3Dd4` (cancelled), `rsv_Ee5Ff6` (completed)
- No PII, no idempotency key seeds (runtime only)

### ✅ Phase 3 — Env + Startup Config

**`.env.example`** — documents 4 required vars: `PORT`, `NODE_ENV`, `BASE_URL`, `DATABASE_PATH`

**`app.js`** changes:
- Loads `.env` relative to `service/` (works regardless of cwd)
- `assertRequiredConfig()` — refuses to start if any required var is missing or PORT is invalid
- Exposes config on `app.locals.config`
- `/health` returns 200 without checking DB (assignment rule A.10)
- Route mounts still commented out (waiting for P2/P3)
- Global error handler is a stub (waiting for P4's `problem.js`)

**`db/init.js`** + `npm run db:init` script added to `package.json`:
- Deletes existing SQLite file, applies `schema.sql` + `seed.sql` via `better-sqlite3`
- Validates `DATABASE_PATH` env var before running

---

## What's NOT Done Yet

### 🔲 Phase 4 — Finish `/health` + README status

- `/health` endpoint code is already working, just needs status updated in `service/README.md` from `IN PROGRESS` to `DONE`
- No other README changes needed until integration

### 🔲 Phase 5 — Integration (after P2/P3/P4 deliver)

In `app.js`:
1. Uncomment and `require` rooms + reservations routers
2. Wire global error handler to P4's `problem.js` (RFC 9457 `application/problem+json`)
3. Optionally make 404 fallback use same problem shape
4. Smoke-check all mounted routes

### 🔲 Phase 6 — Deployment support

1. Add deployment URL to `service/README.md`
2. Verify DB survives restart (create → stop → start → read back)
3. Support the 3 grader demos:
   - One read via deployed URL
   - One write → then read the created entity
   - Same write twice with same Idempotency-Key → one entity, survives restart

---

## Environment Setup (current blocker)

The project requires **Node 20** (see `.nvmrc`). Machine currently has Node 24.
`better-sqlite3` needs C++ build tools or a matching prebuild for Node 20.

### Steps to get running

```bash
# 1. Install Node 20 (if not done)
winget install OpenJS.NodeJS.20
# Close and reopen terminal, verify:
node -v  # should be v20.x.x

# 2. In service/ folder:
cd "D:\Rama Pratama\Codes\Cursor\study-reservation-pbse\service"
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npm run db:init
npm run dev

# 3. Verify:
curl http://localhost:8080/health
```

---

## Key Rules (from assignment)

- Contract (`openapi.yaml`) is the reference — fix implementation, not the contract
- No credentials in source code; `.env` is gitignored
- Each member commits with their own Git identity
- Schema changes only through P1 after team agreement
- `/health` must NOT check the database
- All SQL lives in `store/` (not P1's concern except schema/seed)
- Tag `l3` when done, include deployment URL in README

## Git

- Currently on branch `feature/database-infra`
- No commits made yet by this agent (user handles git manually)
- Git strategy: each person works on their own feature branch, merge to `main` at integration
