# Service Implementation — Study Room Reservation API

This directory contains the backend implementation for the Study Room Reservation System (PBSE Week 3–4).

## Deployed URL (use this only)

- **Production URL:** https://study-reservation-pbse-feature-data.vercel.app
- **Health Check:** https://study-reservation-pbse-feature-data.vercel.app/health

**Do not** use Preview deployment URLs (e.g. `*-lq2smimvx.vercel.app`). Those often redirect to **Vercel SSO (302 HTML)** and are unusable for API clients / Assignment 5.

> Cold starts can take a few seconds. SQLite on Vercel is **in-memory per isolate** (`api/index.js` forces `:memory:`); prove process-restart persistence locally with `npm run db:init` + file DB.

### Teammate paste (Assignment 5)

```
API base (Production only):
https://study-reservation-pbse-feature-data.vercel.app

- GET /health → 200 JSON (no auth)
- GET /v1/rooms without Authorization → 401 Problem Details (Session 4; rooms:read required)
- Do NOT use Preview URLs (Vercel login HTML)
- Send Authorization: Bearer <token> with scopes matching routes
  (rooms:read, reservations:read, reservations:create, reservations:cancel, reservations:checkin)
```

---

## Deploy (Vercel free / Hobby)

Production branch: **`main`**. Node.js **20.x**.

### One-time project settings (required)

1. Vercel → Project → **Settings → General → Node.js Version** → **20.x**
2. **Settings → Git → Production Branch** → **`main`**
3. **Settings → Deployment Protection** → turn **off** Vercel Authentication for **Production**  
   (Preview may stay protected. Preview SSO returns HTML login instead of the API.)

### Env vars (Production)

Set under **Settings → Environment Variables** (scope: Production), then **Redeploy**:

| Name | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_PATH` | `/tmp/reservation.sqlite` (documented; runtime still uses `:memory:` on Vercel) |
| `BASE_URL` | `https://study-reservation-pbse-feature-data.vercel.app` |
| `OIDC_ISSUER` | `http://localhost:8080/realms/study-reservation` |
| `OIDC_JWKS_URI` | `http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs` |
| `OIDC_AUDIENCE` | `study-reservation-api` |
| `DEV_AUTH_SECRET` | same as local lab secret (optional for 401 smoke; needed to verify HS256 lab tokens) |

`OIDC_*` must be **non-empty** or Express boot fails with 500. Localhost issuer strings are **boot placeholders** (iss/aud string checks). They are **not** a reachable IdP from Vercel. Real RS256 Keycloak tokens need a public IdP later. Unauthenticated protected routes still return **401** once boot succeeds.

### After env or code change

1. Push / merge to **`main`**, or Vercel → **Deployments** → Redeploy Production
2. Wait until Production is Ready
3. Smoke (PowerShell — use `curl.exe`, not PowerShell `curl` alias):

```powershell
$BASE = "https://study-reservation-pbse-feature-data.vercel.app"

curl.exe -sS "$BASE/health"
# expect 200 JSON: {"status":"pass",...}

curl.exe -sS -D - -o - "$BASE/v1/rooms"
# expect 401 application/problem+json — NOT 500, NOT 302 HTML login
```

---

## How Vercel boot works

- `api/index.js` boots **sql.js** (WASM under `api/_vendor/`)
- On first non-health request: `ensureDatabase()` then loads Express
- `:memory:` seed is **idempotent** (seed only if `rooms` is empty) so a failed boot retry does not hit `UNIQUE constraint failed: rooms.id`
- `/health` responds without loading Express (so it works even if OIDC env is missing)

---

## Grader / smoke cheat sheet

### Live (public Production URL) — PowerShell

```powershell
$BASE = "https://study-reservation-pbse-feature-data.vercel.app"

curl.exe -sS "$BASE/health"
# 200 JSON

curl.exe -sS -D - -o - "$BASE/v1/rooms"
# 401 without Bearer (Session 4 requires rooms:read)

# With a valid Bearer + rooms:read scope → 200 + room array
# curl.exe -sS -H "Authorization: Bearer <token>" "$BASE/v1/rooms"
```

### Local restart + idempotency (A.7 / A.8)

```powershell
cd service
Copy-Item .env.example .env
npm ci
npm run db:init
npm start
# create → POST again with SAME Idempotency-Key → one row
# Ctrl+C → npm start → GET same id still exists
```

---

## 📊 Operation Status Table

> **Requirement from Assignment (Section A.3):**
> Track implementation status for all operations defined in `openapi.yaml`.
> Allowed statuses: `DONE`, `IN PROGRESS`, `MOCK`.

| Method | Path | Operation ID | Owner | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | `getHealth` | **P1** | `DONE` | Server infrastructure & health check — verified `200`, no DB dependency |
| `GET` | `/v1/rooms` | `listRooms` | **P2** | `DONE` | Collection read, returns `200 + []` if empty, schema conformance verified |
| `GET` | `/v1/rooms/{roomId}` | `getRoom` | **P2** | `DONE` | Single entity read; malformed ID -> 400 Problem Details, not found -> 404 |
| `GET` | `/v1/reservations` | `listReservations` | **P3** | `DONE` | Collection read with status filter & pagination |
| `POST` | `/v1/reservations` | `createReservation` | **P3** / **P4** | `DONE` | Unsafe write with server-side DB idempotency & RFC 9457 errors |
| `GET` | `/v1/reservations/{reservationId}` | `getReservation` | **P3** | `DONE` | Single entity lookup; malformed ID -> 400 Problem Details |
| `POST` | `/v1/reservations/{reservationId}/cancellation` | `cancelReservation` | **P3** | `DONE` | Sub-resource state transition; idempotent on re-cancellation (200), illegal-transition (409) |

---

## ⚠️ RFC 9457 Problem Details Error Catalog (Assignment Section A.6)

> Every failure response is produced by a single standardized helper in `src/problem.js` setting `Content-Type: application/problem+json`.

| Cause inside Handler | HTTP Status | `type` URI | `title` | Extension Members |
| :--- | :--- | :--- | :--- | :--- |
| Missing or malformed `Idempotency-Key` header | `400` | `https://api.library.example/problems/malformed-request` | `The request could not be parsed` | `detail`, `instance` |
| Malformed ID format (`roomId` or `reservationId`) | `400` | `https://api.library.example/problems/malformed-request` | `The request could not be parsed` | `detail`, `instance`, `fields` |
| Malformed body syntax or missing required fields | `400` | `https://api.library.example/problems/malformed-request` | `The request could not be parsed` | `detail`, `instance`, `fields` |
| Unknown query parameter or invalid query enum | `400` | `https://api.library.example/problems/malformed-request` | `The request could not be parsed` | `detail`, `instance` |
| Non-existent resource ID on GET or state transition | `404` | `https://api.library.example/problems/not-found` | `Resource not found` | `detail`, `instance` |
| Semantic logic error: `endTime <= startTime` | `422` | `https://api.library.example/problems/validation-failed` | `One or more fields are invalid` | `detail`, `instance`, `fields` |
| Non-existent `roomId` in reservation creation body | `422` | `https://api.library.example/problems/validation-failed` | `One or more fields are invalid` | `detail`, `instance`, `fields` |
| Room already booked for the requested time slot | `409` | `https://api.library.example/problems/room-unavailable` | `The room is already reserved for the requested time` | `detail`, `instance` |
| Idempotency-Key reused with different request payload | `409` | `https://api.library.example/problems/idempotency-key-reuse` | `Idempotency-Key has already been used with a different request body` | `detail`, `instance` |
| Illegal state transition (cancellation from non-pending) | `409` | `https://api.library.example/problems/illegal-transition` | `That status change is not permitted` | `from`, `to`, `allowedFrom`, `detail`, `instance` |
| Unexpected unhandled exception or crash | `500` | `https://api.library.example/problems/internal-server-error` | `Internal Server Error` | `instance` (no stack traces or DB leaks) |

---

## 🛠️ How to Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Initialize database (Person 1):**
   ```bash
   npm run db:init
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The service will be listening on `http://localhost:8080`.

5. **Run all tests (Person 4):**
   ```bash
   npm test
   ```

6. **Run contract conformance tests only:**
   ```bash
   npm run test:contract
   ```
