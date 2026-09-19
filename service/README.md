# Service Implementation — Study Room Reservation API

This directory contains the backend implementation for the Study Room Reservation System (PBSE Week 3).

## Deployed URL

- **Production URL:** https://study-reservation-pbse-feature-data.vercel.app
- **Health Check:** https://study-reservation-pbse-feature-data.vercel.app/health

Verified on Production (`bbada02`): `/health`, `GET /v1/rooms`, create reservation, get by id, and idempotent replay.

> Cold starts can take a few seconds. SQLite on Vercel is in-memory per isolate; prove A.7 process-restart locally.

---

## Deploy (Vercel free / Hobby)

Branch: **`p3-fixed`** (not `main`). Node.js **20.x**.

### One-time project settings (required)

1. Vercel → Project → **Settings → General → Node.js Version** → **20.x**
2. **Settings → Git → Production Branch** → set to **`p3-fixed`** (or keep `main` and use Promote below)
3. **Settings → Deployment Protection** → turn **off** Vercel Authentication for Production  
   (Preview SSO returns HTML login pages instead of the API — graders cannot use a protected Preview URL)

### Promote latest fix to Production

1. Vercel → **Deployments**
2. Open the latest deployment from branch **`p3-fixed`** (commit message about Vercel/sql.js/`_vendor`)
3. **⋯ → Promote to Production**
4. Wait until Production is Ready
5. Test: `https://study-reservation-pbse-feature-data.vercel.app/health`  
   Expect JSON: `{"status":"pass",...}` — **not** HTML and **not** `FUNCTION_INVOCATION_FAILED`

### Env vars (Production)

- `NODE_ENV` = `production`
- `PORT` = `3000`
- `DATABASE_PATH` = `/tmp/reservation.sqlite`
- `BASE_URL` = `https://study-reservation-pbse-feature-data.vercel.app`

### How it works

- `api/index.js` boots **sql.js** (WASM under `api/_vendor/`, not a native addon)
- `serverless-http` adapts Express
- SQLite file is created under `/tmp` on cold start from `api/schema.sql` + `api/seed.sql`
- A.7 restart demo is still done **locally** (Vercel `/tmp` is ephemeral)

---

## Grader demo cheat sheet

### Live (public Production URL)

```bash
BASE=https://study-reservation-pbse-feature-data.vercel.app

curl -s "$BASE/health"
curl -s "$BASE/v1/rooms"

KEY=$(uuidgen)
curl -s -D - -X POST "$BASE/v1/reservations" \
  -H "Idempotency-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"roomId":"rm_1a2B3cD","date":"2026-12-15","startTime":"08:00","endTime":"09:00"}'
```

### Local restart + idempotency (A.7 / A.8)

```bash
cd service
cp .env.example .env
npm ci && npm run db:init && npm start
# create → POST again with SAME key → one row
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

---

## Scope vocabulary (Session 4 / P4 Step 2)

Scopes are derived from actor capabilities, not one-per-endpoint. Exact strings below are reused on the authorisation server (Step 3), in `openapi.yaml` (Step 4), and by `requireScope` (Step 7). A scope permits a *kind* of operation; Layer 3 (object ownership) decides which records are visible.

| Scope | Permits | Student | Display | Job |
|-------|---------|---------|---------|-----|
| `rooms:read` | Browse rooms and room details | yes | yes | — |
| `reservations:read` | Read reservations visible to the principal | yes | yes | — |
| `reservations:write` | Create and cancel own reservations | yes | — | — |
| `rooms:display` | Sync schedule / status for an assigned room | — | yes | — |
| `reservations:checkin` | Check a reservation in at a room | — | yes | — |
| `reservations:cleanup` | Mark abandoned reservations (e.g. no-show) | — | — | yes |

### Current OpenAPI operation → scope

| Operation ID | Scope |
|--------------|-------|
| `getHealth` | *(public — no token)* |
| `listRooms` | `rooms:read` |
| `getRoom` | `rooms:read` |
| `listReservations` | `reservations:read` |
| `getReservation` | `reservations:read` |
| `createReservation` | `reservations:write` |
| `cancelReservation` | `reservations:write` |

`rooms:display`, `reservations:checkin`, and `reservations:cleanup` are registered now for display/job clients even though check-in and cleanup routes are not yet in the contract.

Auth decisions (clients, Keycloak, test tokens): [`docs/decisions/0003-autentikasi.md`](../docs/decisions/0003-autentikasi.md). Local IdP: [`infra/README.md`](../infra/README.md).

**Teammates continuing from Step 4:** see [`docs/P4-teammate-handoff.md`](../docs/P4-teammate-handoff.md).
