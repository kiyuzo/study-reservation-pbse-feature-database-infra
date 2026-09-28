# Study Room Reservation System (PBSE)

A contract-first study room reservation backend system built for Platform-Based Software Engineering (PBSE)

---

## System Overview

A student checks the availability of study rooms in the library on a given date and time. They select an available room and reserve it. An automated cleanup job periodically checks if reserved rooms have been occupied (via check-in); if a student doesn't check in within 15 minutes, the job cancels the reservation. A room display screen outside each room shows the current reservation status and allows students to check in. If a student tries to reserve a room that was just booked by someone else a second ago, the reservation fails.

### Actors
1. **Student (Human Actor):** Operates on mobile networks; requires `Idempotency-Key` on creation endpoints to guarantee retries never double-book.
2. **Room Display Screen (IoT Device):** Outside each room, syncs room schedules and handles check-ins.
3. **Automated Cleanup Job (Background Worker):** Sweeps abandoned reservations (`pending_checkin` -> `no_show`).

### Workflow Mapping

| Workflow | UI Screen(s) | Role / Access | URL | API Operation(s) |
| :--- | :--- | :--- | :--- | :--- |
| Browse available study rooms | Dashboard → Study Rooms | Student / Staff / Admin with room access | `/rooms` | `GET /v1/rooms` |
| Inspect a study room and reserve it | Study Rooms → Room Detail → Reservation | Student / Staff / Admin with reservation-create access | `/rooms/{roomId}` | `GET /v1/rooms/{roomId}`; `POST /v1/reservations` |
| Review personal reservations | My Reservations | Student / Staff / Admin with reservation-read access | `/reservations` | `GET /v1/reservations` |
| Manage all room reservations | All Reservations | Staff / Admin with `admin:manage` access | `/reservations` | `GET /v1/reservations`; `POST /v1/reservations/{reservationId}/check-in`; `POST /v1/reservations/{reservationId}/cancellation` |

### Role-Based Navigation

The navigation menu changes according to the active persona's scopes:

- **Dashboard** — available as the main entry point.
- **Study Rooms** — available for room browsing.
- **My Reservations** — displayed when the active persona has `reservations:read`.
- **Security & Access** — displayed when the active persona has `admin:manage`.
- **Audit Logs** — displayed when the active persona has `admin:manage`.

The frontend uses the same scope information provided by `AuthContext`
for navigation visibility and route protection.

### Session Storage & Authentication

The frontend keeps the active authentication token in memory rather than `localStorage`, so the token is not persisted across a full browser refresh or stored as persistent browser data. This reduces the risk of a token remaining in browser storage, but it also means the user must authenticate again after a page reload.

When authentication expires or the API returns `401 Unauthorized`, the frontend clears the in-memory session and temporarily stores the current return path in `sessionStorage` so the user can be redirected back after signing in. The return path is temporary and is cleared after it is used.

### URL-Based Routing

The frontend uses React Router with `BrowserRouter`.

Each main workflow has its own URL:

```text
/                       → Dashboard
/rooms                  → Study Rooms
/rooms/{roomId}         → Room Detail
/reservations           → My Reservations
/security               → Security & Access
/audit                  → Audit Logs
```

---

## Repository Structure

```text
.
├── openapi.yaml                 # The contract (source of truth)
├── CHANGELOG.md                 # Contract revisions log
├── README.md                    # Root project documentation & test analysis
├── .gitignore                   # Ignore node_modules, .env, DB files
├── docs/
│   └── decisions/
│       └── 0002-implementasi.md # Architecture decision record
├── service/                     # Backend service implementation
│   ├── package.json
│   ├── .env.example
│   ├── README.md                # Operation-status tracking & RFC 9457 catalog
│   ├── db/
│   │   ├── schema.sql           # Database table definitions
│   │   ├── seed.sql             # Demo seed data
│   │   └── init.js              # Database initialization script
│   └── src/
│       ├── app.js               # Express application entrypoint
│       ├── problem.js            # RFC 9457 error builder & middleware
│       ├── routes/              # Express route handlers (rooms, reservations)
│       ├── schemas/             # Request validation logic
│       ├── store/               # SQL database access layer (rooms, reservations, idempotency)
│       └── representations/     # DB-to-API response mappers
├── tests/
│   ├── setup.js                 # Test environment & polyfill configuration
│   ├── contract/                # Conformance tests against openapi.yaml
│   │   ├── rooms.test.js        # Rooms contract tests
│   │   └── reservations.test.js # Reservations contract tests
│   └── idempotency/             # Server-side idempotency tests
│       └── idempotency.test.js  # Decision tree & restart persistence tests
└── .github/
    └── workflows/
        └── ci.yml               # Automated CI workflow
```

---

## Test Results

| Test Suite | Result |
| :--- | :--- |
| Contract Tests — Rooms | 5/5 Passed |
| Contract Tests — Reservations | 18/18 Passed |
| Idempotency Tests | 9/9 Passed |
| Production Verification | 8/8 Passed |

The test suites verify OpenAPI contract conformance, request validation,
reservation conflicts, RFC 9457 Problem Details, idempotency behavior,
conditional requests, and authorization.

### Server-Side Idempotency Analysis

Reservation creation requires an `Idempotency-Key`

The server stores the key and request-body hash in SQLite to ensure:
- identical retries replay the original response;
- reuse with a different request body returns `409 Conflict`;
- idempotency records survive application restarts.
```

#### Key Findings from Idempotency Tests:
1. **Zero Duplicate Records:** Replaying the identical write request with the same `Idempotency-Key` returned identical `201 Created` response bodies and headers (`Location`), with SQLite reservation row count remaining exactly 1.
2. **Key Tampering Protection:** Using the same key with an altered payload immediately triggered `409 Conflict` (`https://api.library.example/problems/idempotency-key-reuse`) and `Content-Type: application/problem+json`.
3. **Restart Durability:** Simulated complete application restart (`jest.resetModules()`). The fresh application instance retrieved the idempotency record from SQLite disk storage, verifying that keys survive server restarts.

---

## Quick Start

1. Install dependencies:
   ```bash
   cd service
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Initialize SQLite database:
   ```bash
   npm run db:init
   ```

4. Run full test suite:
   ```bash
   npm test
   ```

5. Run dev server:
   ```bash
   npm run dev
   ```

6. Verify health endpoint:
   ```bash
   curl http://localhost:8080/health
   ```

---

## Conditional Requests

### Conditional Reads (A.7)
- **Mechanism:** HTTP `ETag` + `If-None-Match` + `304 Not Modified`.
- **Target Collection:** Polling periodically against `GET /v1/rooms` (and `GET /v1/reservations`).
- **Implementation in Centralized API Layer (`frontend/src/api/client.ts`):**
  - Uses an in-memory cache structure: `Map<string, CacheEntry>` storing the last emitted ETag, timestamp, and payload data.
  - Automatically attaches `If-None-Match: "<cached-etag>"` to collection reads.
  - Intercepts HTTP `304 Not Modified`: treats it as a successful read, preserves the existing UI items in state, clears any stale markers, and updates the "Last synced" display.
  - When the collection is updated on the server, a `200 OK` is returned with a new ETag, updating both the cache and UI items seamlessly.
- **Background Polling:**
  - Configured at an interval (12 seconds) in `frontend/src/pages/Rooms.tsx` with request overlap prevention (`isFetchingRef`).
  - Gracefully handles network disconnects by flagging existing data as stale ("Showing data from HH:MM · Reconnecting...") without replacing valid content with a blank loader.

### Conditional Writes (A.8)
- **Mechanism:** HTTP `If-Match` + `412 Precondition Failed` (RFC 9457 Problem Details).
- **Target State-Changing Operations:**
  - `POST /v1/reservations/{reservationId}/cancellation`
  - `POST /v1/reservations/{reservationId}/check-in` (and `/checkin`)
- **Concurrency & Lost Update Prevention:**
  - Centralized API layer accepts `{ etag?: string }` and attaches `If-Match: "<etag>"`.
  - When concurrent actions occur (e.g. Window A cancels while Window B attempts to cancel or check in):
    - Window A succeeds (`201 Created` / `200 OK`) and advances the entity ETag.
    - Window B's request with the stale ETag is rejected with `412 Precondition Failed` and RFC 9457 problem type `https://api.library.example/problems/precondition-failed`.
  - **Frontend Domain Handling (`frontend/src/pages/MyReservations.tsx`):**
    - 412 is **never** shown as a generic red error or 500.
    - An amber concurrency banner explains: *"Concurrency Conflict (HTTP 412): This reservation has already been updated. The latest reservation details have been refreshed below."*
    - The client immediately re-fetches the latest reservation representation, updates the local ETag cache, and refreshes the available actions.

---

## Authorization Testing (A.9 Console Attack)

The assignment requires verifying that hiding UI buttons does not constitute security. All authorizations are strictly enforced on the server.

### Test Personas & Accounts
| Account / Persona | Role | Assigned Scopes | Purpose |
| :--- | :--- | :--- | :--- |
| `student-a` | Student | `rooms:read`, `reservations:read`, `reservations:create`, `reservations:cancel`, `reservations:checkin`, `reservations:write` | Owner of `rsv_9X8y7Z` and `rsv_Cc3Dd4`. Normal workflow & concurrency test. |
| `student-b` | Student | `rooms:read`, `reservations:read`, `reservations:create`, `reservations:cancel`, `reservations:write` | Owner of `rsv_Aa1Bb2`. Used to test Layer 3 foreign object denial. |
| `student-limited` | Student | `rooms:read` | Used to test Layer 2 missing scope denial (`403 Forbidden`). |
| `admin-user` | Admin / Staff | `admin:manage` + all operational scopes | Full system access. |

### Browser Console Attack Procedure
Open browser Developer Tools (F12) → Console tab on the deployed frontend (`https://study-reservation-pbse-frontend.vercel.app`), and execute:

```javascript
// Example Attack 1: Student attempting staff/admin protected operation or missing scope
fetch("https://study-reservation-pbse-feature-data-five.vercel.app/v1/reservations", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID()
  },
  body: JSON.stringify({ roomId: "rm_1a2B3cD", date: "2026-10-01", startTime: "09:00", endTime: "10:00" })
}).then(r => r.json()).then(console.log);

// Example Attack 2: Student B attempting to access Student A's reservation
fetch("https://study-reservation-pbse-feature-data-five.vercel.app/v1/reservations/rsv_9X8y7Z", {
  headers: { "Authorization": "Bearer " + studentBToken }
}).then(r => r.json()).then(console.log);
```

### Authorization Test Report
| Scenario | Account / Actor | Operation Attempted | Expected Status | Observed Status | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1: Unauthenticated** | Anonymous (No token) | `GET /v1/reservations/rsv_9X8y7Z` | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Layer 2: Scope Denial** | `student-limited` | `GET /v1/reservations` | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **Layer 3: Foreign Object Access** | `student-b` | `GET /v1/reservations/rsv_9X8y7Z` (belongs to `student-a`) | `404 Not Found` (Zero ownership leakage) | `404 Not Found` | **PASS** |
| **Authorized Owner Access** | `student-a` | `GET /v1/reservations/rsv_9X8y7Z` | `200 OK` | `200 OK` | **PASS** |
| **Direct URL Access** | Unauthenticated | Direct paste of `/reservations` into address bar | Client redirects / prompts login; API returns `401` | `401` on API fetch | **PASS** |

---

## Production Deployment (Unified Full Stack)

The entire Study Room Reservation System is deployed and publicly accessible **under the same unified link**, hosting both the Frontend UI and Backend REST API on a single origin.

### Unified Production Link (FE + BE)
- **Primary Unified Application URL:** [https://study-reservation-pbse-feature-data-five.vercel.app](https://study-reservation-pbse-feature-data-five.vercel.app)
  - **Frontend SPA (UI):** [https://study-reservation-pbse-feature-data-five.vercel.app/](https://study-reservation-pbse-feature-data-five.vercel.app/)
  - **Sign In Portal:** [https://study-reservation-pbse-feature-data-five.vercel.app/signin](https://study-reservation-pbse-feature-data-five.vercel.app/signin)
  - **Study Rooms UI:** [https://study-reservation-pbse-feature-data-five.vercel.app/rooms](https://study-reservation-pbse-feature-data-five.vercel.app/rooms)
  - **My Reservations UI:** [https://study-reservation-pbse-feature-data-five.vercel.app/reservations](https://study-reservation-pbse-feature-data-five.vercel.app/reservations)
  - **Backend Health Check:** [https://study-reservation-pbse-feature-data-five.vercel.app/health](https://study-reservation-pbse-feature-data-five.vercel.app/health)
  - **Backend REST API:** [https://study-reservation-pbse-feature-data-five.vercel.app/v1/rooms](https://study-reservation-pbse-feature-data-five.vercel.app/v1/rooms)
  - **API Documentation:** [https://study-reservation-pbse-feature-data-five.vercel.app/docs](https://study-reservation-pbse-feature-data-five.vercel.app/docs)

*Note: Dedicated standalone frontend alias (https://study-reservation-pbse-feature-data-five.vercel.app) remains active as an alternate endpoint.*

### Database Infrastructure
- **Database Engine:** SQLite (via `sql.js` WASM on Vercel Serverless with binary disk export/reload; `better-sqlite3` native driver for local test execution).
- **Persistent Storage:** `/tmp/reservation.sqlite` on serverless runtime; seeded with initial rooms, demo reservations, and owner mappings.

### Production Environment Variables
#### Frontend (`frontend/.env.production` / Vercel Environment Variables)
```ini
VITE_API_BASE_URL=https://study-reservation-pbse-feature-data-five.vercel.app/
```

#### Backend (`service/.env` / Vercel Environment Variables)
```ini
NODE_ENV=production
PORT=3000
DATABASE_PATH=/tmp/reservation.sqlite
BASE_URL=https://study-reservation-pbse-feature-data-five.vercel.app
CORS_ALLOWED_ORIGINS=https://study-reservation-pbse-frontend.vercel.app,http://localhost:5173,http://localhost:3000
OIDC_ISSUER=http://localhost:8080/realms/study-reservation
OIDC_JWKS_URI=http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs
OIDC_AUDIENCE=study-reservation-api
DEV_AUTH_SECRET=dev-pbse-local-secret-for-jwt-signing-safe-fallback
```

### Full-Stack Verification Results (`npm run verify:prod`)
```text
====================================================
STUDY ROOM RESERVATION SYSTEM — PRODUCTION VERIFICATION
Backend Target:  https://study-reservation-pbse-feature-data-five.vercel.app
Frontend Origin: https://study-reservation-pbse-frontend.vercel.app
====================================================

[PASS] 1. /health returns 200 Pass
[PASS] 2. Production CORS preflight accepts frontend origin and exposes ETag
[PASS] 3. A.7 First GET /v1/rooms returns 200 with ETag: "rooms-a9895b1c4bce0c53"
[PASS] 4. A.7 Second GET with If-None-Match returns 304 Not Modified with empty body
[PASS] 5. A.8 POST cancellation with stale If-Match returns 412 Precondition Failed (Precondition Failed)
[PASS] 6. A.9 Console Attack 1: Student with missing scope receives 403 Forbidden (Never 200)
[PASS] 7. A.9 Console Attack 2: Student B accessing Student A reservation receives 404 (ownership NOT leaked)
[PASS] 8. A.9 Console Attack 3: Unauthenticated access returns 401 Unauthorized

====================================================
SUMMARY: 8 PASSED, 0 FAILED
====================================================
```

