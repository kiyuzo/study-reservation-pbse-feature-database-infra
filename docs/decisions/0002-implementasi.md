# 2. Service Implementation & Architecture Decisions

- **Status:** Accepted
- **Date:** 2026-09-08
- **Author:** PERSON 4 (Cross-Cutting Errors + Idempotency + CI)

## Context
The Study Room Reservation API requires a production-ready backend service conforming strictly to the `openapi.yaml` specification. The service must persist data across restarts, handle idempotency correctly (preventing duplicate bookings across flaky client connections and retries), and provide RFC 9457 Problem Details (`application/problem+json`) for all client and server failures.

Furthermore, Assignment Section A.11 mandates documenting the choice of hosting provider, the server-side idempotency storage mechanism, and any structural deviations from the course specification.

---

## Decision

### 1. Hosting Provider
- **Decision:** Deploy service as a Docker container / Node.js service on **Render / Railway** (with persistent disk volume for SQLite) or Cloud VPS.
- **Rationale:** 
  - Supports Node.js 20 runtime and zero-downtime health checking via `/health`.
  - Attachable persistent volume mounts (`/data` or `./db`) guarantee that SQLite database files (`reservation.sqlite`) survive application deployments and container restarts without data loss.
  - Allows public HTTPS endpoint provisioning with environment variable configuration without committing credentials or environment files.

### 2. Idempotency Storage
- **Decision:** Dedicated SQLite table `idempotency_keys` committed in `service/db/schema.sql`, accessed exclusively via `service/src/store/idempotency.js`.
  - **Schema:**
    ```sql
    CREATE TABLE IF NOT EXISTS idempotency_keys (
        key              TEXT PRIMARY KEY,
        request_hash     TEXT NOT NULL,
        response_status  INTEGER NOT NULL,
        response_body    TEXT NOT NULL,
        created_at       TEXT NOT NULL,
        expires_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
        ON idempotency_keys (expires_at);
    ```
  - **Payload Hashing:** SHA-256 hash computed deterministically from canonicalized JSON request body.
  - **Enforced Decision Tree (Assignment Section A.8):**
    1. Header check: Missing or non-UUIDv4 `Idempotency-Key` header -> reject before database access with `400 Bad Request` (`https://api.library.example/problems/malformed-request`).
    2. Key lookup in SQLite:
       - **Never seen before:** Process reservation, compute SHA-256 body hash, store key and 201 response representation into `idempotency_keys`, return `201 Created` with `Location` header.
       - **Already seen + identical body hash:** Return the cached `201 Created` response directly without creating duplicate database entities.
       - **Already seen + different body hash:** Reject with `409 Conflict` (`https://api.library.example/problems/idempotency-key-reuse`) and `Content-Type: application/problem+json`.
  - **Retention:** Stored with a 24-hour expiration timestamp (`expires_at`) matching OpenAPI specification.

### 3. Structural Conformance
- **Decision:** 100% adherence to the course required directory structure:
  - `openapi.yaml` at root level as single source of truth.
  - `service/src/routes/`: Route declarations and operation controllers.
  - `service/src/schemas/`: Contract-derived validation rules.
  - `service/src/store/`: Database access layer (only layer with SQL queries).
  - `service/src/representations/`: Raw database row to public contract representation mappers.
  - `service/src/problem.js`: Single standardized RFC 9457 error builder and middleware.
  - `tests/contract/`: Automated contract conformance test suite against live service.
  - `tests/idempotency/`: Dedicated idempotency verification and restart persistence tests.
  - `.github/workflows/ci.yml`: Automated CI workflow testing schema migrations and contract conformance on every push.

---

## Alternatives Considered

1. **In-Memory Idempotency Cache (e.g. Map / LRU Cache):**
   - *Rejected:* Fails the core requirement of Assignment Section A.7 & A.8. Network retry storms and retries most frequently happen when a server has just crashed or restarted. In-memory caches lose all keys upon process restart, leading to duplicate room bookings.
2. **External Redis / Key-Value Store:**
   - *Considered:* Offers native TTL expiration, but introduces external infrastructure dependencies, network hops, and additional operational failure points for a lightweight single-node reservation service. Storing keys directly in SQLite provides ACID transactional guarantees alongside the `reservations` table without extra moving parts.
3. **HTTP 500 on Client Validation / Idempotency Errors:**
   - *Rejected:* Violates RFC 9457 and HTTP specifications. Validation failures are client errors (`400`/`422`), conflicts are domain errors (`409`), while `500` is strictly reserved for unexpected system failures and stripped of sensitive internal details.

---

## Consequences

- **Durability Across Restarts:** Idempotency records survive process crashes, server reboots, and rolling restarts.
- **Contract Conformance:** API clients receive deterministic, standardized `application/problem+json` errors matching `openapi.yaml`.
- **Zero Conflict Development:** Person 3 (`reservations.js`) consumes Person 4's idempotency store (`store/idempotency.js`) without modifying each other's core implementation files.
- **Continuous Quality Assurance:** Automated GitHub Actions CI executes on every push and PR, ensuring that regressions against the contract are caught immediately.
