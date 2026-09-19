# P4 teammate handoff (Steps 0–3 done → continue from Step 4)

**Branch:** `p4-rama`  
**Status:** Session 4 Steps **0–3** are finished (baseline, client classification, scopes, local Keycloak).  
**Your starting point:** **Step 4** — declare security in `openapi.yaml` (+ `CHANGELOG.md`). Do **not** rewrite Session 3 operations.

Auth middleware / Layer 1–3 code is **not** implemented yet — that is Steps 5+.

---

## Pull the branch

```bash
git fetch origin
git checkout p4-rama
git pull
```

---

## Read these first (in order)

1. [`docs/decisions/0003-autentikasi.md`](decisions/0003-autentikasi.md) — clients, decisions + reasons, test users, OIDC audience  
2. [`service/README.md`](../service/README.md) — **scope vocabulary** (exact strings for OpenAPI and later `requireScope`)  
3. [`infra/README.md`](../infra/README.md) — how to run Keycloak locally  

Assignment PDF (if you have it): Session 4 Steps 4–12.

---

## Scope strings (must match everywhere)

Use these exact values in Keycloak (already imported), OpenAPI Step 4, and code Step 7:

| Scope | Meaning |
|-------|---------|
| `rooms:read` | Browse rooms and room details |
| `reservations:read` | Read reservations visible to the principal |
| `reservations:write` | Create and cancel own reservations |
| `rooms:display` | Sync schedule / status for an assigned room |
| `reservations:checkin` | Check a reservation in at a room |
| `reservations:cleanup` | Mark abandoned reservations (e.g. no-show) |

Current ops → scope map is in `service/README.md`. `getHealth` stays public (no token).

---

## Local Keycloak (lab credentials)

These are **local demo values only** — not production secrets.

```bash
cd infra
cp .env.example .env
# Set KC_ADMIN_PASSWORD to any local password
docker compose -f docker-compose.auth.yml up -d
```

| Item | Value |
|------|--------|
| Admin console | http://localhost:8080 |
| Admin user | `admin` / your `KC_ADMIN_PASSWORD` from `infra/.env` |
| Realm | `study-reservation` |
| Audience (API) | `study-reservation-api` |
| Test users | `student-a`, `student-b`, `student-c`, `student-d`, `display-a`, `display-b` |
| Test user password | `changeme-test` |
| Dev-only token client | `test-cli` (password grant — not a product client) |
| Cleanup job client | `cleanup-job` (confidential) |
| Cleanup job secret (lab) | `local-dev-cleanup-job-secret` |

Token checkpoint example (do **not** paste tokens into online JWT sites):

```bash
# PowerShell: use curl.exe
curl.exe -s -X POST "http://localhost:8080/realms/study-reservation/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "grant_type=password&client_id=test-cli&username=student-a&password=changeme-test&scope=openid rooms:read"
```

---

## Service `.env` (OIDC placeholders)

Copy `service/.env.example` → `service/.env` and set:

```env
OIDC_ISSUER=http://localhost:8080/realms/study-reservation
OIDC_JWKS_URI=http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs
OIDC_AUDIENCE=study-reservation-api
```

**Port clash:** Keycloak uses host **8080**. When both run, set the API to another port, e.g. `PORT=3099` and `BASE_URL=http://localhost:3099`.

**Node version:** use **Node 20** for `npm ci` / tests on Windows. Node 24 often fails building `better-sqlite3`.

```bash
cd service
npm ci
npm run db:init
npm test
```

---

## What each person picks up next

| Steps | Focus | Main files |
|-------|--------|------------|
| **4** | Security on the contract | `openapi.yaml`, `CHANGELOG.md` |
| **5–6** | Auth config + Layer 1 (JWT → `req.principal`) | `service/src/auth/*`, `app.js`, config |
| **7** | Layer 2 scopes | `require-scope`, routes |
| **8** | Layer 3 object ownership (404 not 403 for “not yours”) | routes / store / representations |
| **9–12** | Log redaction, refresh demo, negative tests, CI + tag `l4` | logger, tests, workflows |

Locked decisions (do not reverse without team agreement): local **Keycloak**, **test signing key** for CI later, clients = web/mobile/display **public PKCE**, cleanup job **confidential**.

---

## Do not share / commit

- Production or Vercel secrets  
- Live access tokens in chat or docs  
- `infra/.env` or `service/.env` (gitignored)

Questions about why Keycloak / public display / scopes were chosen: see the rationale table in `0003-autentikasi.md`.
