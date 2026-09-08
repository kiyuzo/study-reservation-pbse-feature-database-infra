# Study Room Reservation System (PBSE)

A contract-first study room reservation backend system built for Platform-Based Software Engineering (PBSE)

---

## 🏛️ System Overview

A student checks the availability of study rooms in the library on a given date and time. They select an available room and reserve it. An automated cleanup job periodically checks if reserved rooms have been occupied (via check-in); if a student doesn't check in within 15 minutes, the job cancels the reservation. A room display screen outside each room shows the current reservation status and allows students to check in. If a student tries to reserve a room that was just booked by someone else a second ago, the reservation fails.

### Actors
1. **Student (Human Actor):** Operates on mobile networks; requires `Idempotency-Key` on creation endpoints to guarantee retries never double-book.
2. **Room Display Screen (IoT Device):** Outside each room, syncs room schedules and handles check-ins.
3. **Automated Cleanup Job (Background Worker):** Sweeps abandoned reservations (`pending_checkin` -> `no_show`).

---

## 📁 Repository Structure

```
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
│       ├── problem.js           # RFC 9457 error builder & middleware
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

## 👥 Team Roles & Responsibilities

| Role | Focus Area | Owned Files | Branch |
| :--- | :--- | :--- | :--- |
| **PERSON 1** | **Database + App Infrastructure** | `service/db/*`, `service/.env.example`, `service/src/app.js`, `service/README.md` | `feature/database-infra` |
| **PERSON 2** | **Study Room Resource** | `service/src/routes/rooms.js`, `service/src/schemas/rooms.js`, `service/src/store/rooms.js`, `service/src/representations/rooms.js`, `tests/contract/rooms.test.js` | `feature/rooms` |
| **PERSON 3** | **Reservation Resource** | `service/src/routes/reservations.js`, `service/src/schemas/reservations.js`, `service/src/store/reservations.js`, `service/src/representations/reservations.js`, `tests/contract/reservations.test.js` | `feature/reservations` |
| **PERSON 4** | **Errors + Idempotency + CI** | `service/src/problem.js`, `service/src/store/idempotency.js`, `tests/contract/*`, `tests/idempotency/*`, `docs/decisions/*`, `.github/*` | `feature/errors-idempotency` |

---

## 🔒 File Ownership Boundaries

**Rule:** Nobody casually edits another person's files!

- **Person 1 should NOT touch:** `src/routes/`, `src/schemas/`, `src/store/`, `src/representations/`, `src/problem.js`.
- **Person 2 and 3:** All database queries MUST live inside `store/`. Never write SQL in routes or return raw DB rows.
- **Dependency 1 (P3 ↔ P4):** Person 3 calls Person 4's idempotency store (`checkIdempotencyKey`, `saveIdempotencyResult`).
- **Dependency 2 (P1 ↔ Everyone):** Everyone depends on `schema.sql`. P1 creates the initial schema first, then freezes it. Any schema change requires team agreement before P1 modifies it.

---

## 🧪 Test Results and Analysis (Person 4)

### 1. Test Execution Summary

The test suite executed with **100% pass rate** across all suites:

```text
PASS ../tests/contract/reservations.test.js (18 tests)
PASS ../tests/contract/rooms.test.js (5 tests)
PASS ../tests/idempotency/idempotency.test.js (9 tests)

Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        0.764 s
Ran all test suites.
```

---

### 2. Contract Conformance Test Results & Analysis (`tests/contract/`)

#### A. Study Room Resource (`tests/contract/rooms.test.js` — 5/5 Passed)
- **`GET /v1/rooms` (Collection Read):**
  - Verified `200 OK` returning an array of rooms matching the `Room` schema (`id`, `name`, `capacity`, `location`, `createdAt`).
  - Confirmed timestamps adhere to RFC 3339 format with explicit UTC offset (`+07:00`).
  - Verified query parameter strictness: extra or unknown query parameters produce `400 Bad Request` Problem Details rather than being silently ignored.
- **`GET /v1/rooms/{roomId}` (Entity Read):**
  - Verified `200 OK` for existing room (`rm_1a2B3cD`).
  - **Malformed ID validation before DB lookup:** An invalid room ID (e.g. `invalid_room_id!`) fails pattern validation (`^rm_[A-Za-z0-9]{3,}$`) and returns `400 Bad Request` with `Content-Type: application/problem+json`, **not** `404`.
  - **Missing Entity:** A syntactically valid ID that does not exist (`rm_nonexistent999`) reaches the database and correctly yields `404 Not Found` Problem Details.

#### B. Reservation Resource (`tests/contract/reservations.test.js` — 18/18 Passed)
- **`POST /v1/reservations` (Unsafe Consequential Write):**
  - **Success Path (`201 Created`):** Returns the created entity matching the `Reservation` schema and includes the canonical `Location` header (`/v1/reservations/rsv_...`).
  - **Header Pre-validation (`400 Bad Request`):** Missing or non-UUIDv4 `Idempotency-Key` is rejected with `400` Problem Details before executing any database transactions.
  - **Schema Validation (`400 Bad Request`):** Missing required fields (`roomId`, `date`, `startTime`, `endTime`) or malformed formats yield `400` with field-level details.
  - **Semantic Constraints (`422 Unprocessable Entity`):** Evaluates business constraints where all fields are syntactically valid but semantically unworkable (e.g. `endTime <= startTime` or non-existent `roomId`), returning `type: https://api.library.example/problems/validation-failed`.
  - **Domain Conflict (`409 Conflict`):** Room schedule collisions correctly return `409` (`type: https://api.library.example/problems/room-unavailable`), preventing double bookings.
- **`GET /v1/reservations` (Collection Read with Filtering):**
  - Returns `200 OK` with `{ items: [...] }`.
  - Status filter parameter (`status=checked_in`) successfully isolates matching records; invalid status enum values return `400 Bad Request` Problem Details.
- **`GET /v1/reservations/{reservationId}` (Single Read):**
  - Confirmed distinction between malformed ID (`400`) and absent entity (`404`).
- **`POST /v1/reservations/{id}/cancellation` (Sub-resource State Transition):**
  - Transitions `pending_checkin` to `cancelled`, returning `201 Created` with the `Cancellation` schema.
  - Re-cancelling an already cancelled reservation returns `200 OK` with the existing cancellation record (idempotent state transition).
  - Attempting to cancel a non-pending reservation (e.g. `checked_in`) returns `409 Conflict` with `type: https://api.library.example/problems/illegal-transition` and transition metadata (`from`, `to`, `allowedFrom`).

---

### 3. Server-Side Idempotency Analysis (`tests/idempotency/`)

Server-side idempotency is implemented in `service/src/store/idempotency.js` using SQLite table `idempotency_keys` with SHA-256 request payload hashing.

The test suite (`tests/idempotency/idempotency.test.js` — 9/9 Passed) verifies the **exact decision tree** mandated by the course specification:

```
                  Idempotency-Key Header
                           │
                 [ Validate UUID v4 ]
                  ├── Invalid / Missing ──> 400 Bad Request (RFC 9457)
                  └── Valid
                           │
                     Check Database
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    Never Seen     Already Seen      Already Seen
         │        (Same Body Hash)  (Different Body)
         │                 │                 │
   Process Request   Replay Cached       409 Conflict
   Save Key+Hash       Response        (idempotency-key-
   Save 201 Resp           │                 reuse)
         │                 │
    201 Created       201 Created
  (New DB Record)   (Zero DB Inserts)
```

#### Key Findings from Idempotency Tests:
1. **Zero Duplicate Records:** Replaying the identical write request with the same `Idempotency-Key` returned identical `201 Created` response bodies and headers (`Location`), with SQLite reservation row count remaining exactly 1.
2. **Key Tampering Protection:** Using the same key with an altered payload immediately triggered `409 Conflict` (`https://api.library.example/problems/idempotency-key-reuse`) and `Content-Type: application/problem+json`.
3. **Restart Durability:** Simulated complete application restart (`jest.resetModules()`). The fresh application instance retrieved the idempotency record from SQLite disk storage, verifying that keys survive server restarts.

---

### 4. Demonstrator Grading Verification Checklist

| Requirement | Test Proof | Status |
| :--- | :--- | :--- |
| **1. Read operation served by service** | `GET /v1/rooms` & `GET /v1/reservations/{id}` verified against running app | **PASS** |
| **2. Write operation followed by read** | `POST /v1/reservations` creates `rsv_...` which is immediately queryable via `GET /v1/reservations/{id}` | **PASS** |
| **3. Duplicate write produces exactly 1 entity & survives restart** | `tests/idempotency/idempotency.test.js` verifies replay produces no duplicate row and survives process reload | **PASS** |
| **4. RFC 9457 Problem Details** | All errors set `Content-Type: application/problem+json` with standard fields | **PASS** |
| **5. No hardcoded credentials** | Environment loaded strictly from `.env` / `.env.example` | **PASS** |

---

## 🚀 Quick Start

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
