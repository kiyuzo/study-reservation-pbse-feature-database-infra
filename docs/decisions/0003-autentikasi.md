# 3. Authentication & Authorisation Decisions

- **Status:** Accepted
- **Date:** 2026-09-20
- **Context:** Session 4 (P4) — Authentication and Access Control on top of the Session 3 (`l3`) service

## Context

The Study Room Reservation API from Session 3 is contract-complete and unauthenticated. Session 4 adds authentication (who sent the request) and authorisation (what the caller may access) as three separate layers: token verification → scope check → object ownership check. This ADR records the decisions that must be made before any auth code is written (P4 Steps 0–3).

Domain actors (from OpenAPI / README): **Student**, **Room Display (IoT)**, **Cleanup Job**.

---

## Locked decisions (and why)

| Decision | Choice | Why |
|----------|--------|-----|
| Authorisation server | **Keycloak via Docker** (`infra/docker-compose.auth.yml`) | Matches the assignment’s form, gives full control for Step 10 (refresh rotation + reuse detection), and does not block the team on a shared hosted IdP. CI will still avoid calling Keycloak (test signing key later). |
| How tests obtain tokens | **Test-only signing key** inside the suite (deferred to later steps; named now) | PDF recommendation; CI must not depend on network access to Keycloak. |
| Domain actors | From our OpenAPI/README: **Student**, **Room Display**, **Cleanup Job** | Not KANTIN’s staff/courier fiction — scopes and users must match our contract. |
| Client model | **Option A** + Room Display = **public** | Device holders can inspect a display → no secret on device → Auth Code + PKCE. Cleanup job runs on team infra → confidential + Client Credentials. Web/mobile stay public PKCE for Sessions 5–6. |

### Authorisation server detail

- **Realm:** `study-reservation`
- **Audience (resource server):** `study-reservation-api`
- **Local discovery:** `http://localhost:8080/realms/study-reservation/.well-known/openid-configuration`
- Refresh token **rotation with reuse detection** is enabled on the realm (`revokeRefreshToken: true`, `refreshTokenMaxReuse: 0` — required for Step 10 demonstration).
- Access tokens include `sub` via an explicit `oidc-sub-mapper` on the `study-reservation-api-audience` client scope (Keycloak 26+).

### How tests obtain tokens (detail)

Contract and authz tests will mint JWTs with a suite-local signing key and JWKS that mirrors production claim shape (`iss`, `aud`, `exp`, `sub`, `scope`). Live Keycloak is for manual checkpoints and demos only — not CI.

---

## Step 1 — Client classification

Every application that requests a token is classified by one question: can a user (or device holder) read values stored inside this application?

| Our client | Runs on | Public / Confidential | Flow | Holds a secret? |
|------------|---------|------------------------|------|-----------------|
| Web client (Session 5) | User's browser | Public | Authorization Code + PKCE | No |
| Mobile client (Session 6) | User's device | Public | Authorization Code + PKCE | No |
| Room Display (IoT) | Physical device | Public | Authorization Code + PKCE | No |
| Cleanup job | Team server | Confidential | Client Credentials | Yes (env / secret manager) |

### Rules that follow for public clients

1. Authorization Code with PKCE (S256); **no** client secret.
2. Client generates a random verifier; sends only its hash (challenge) on the authorisation request.
3. Client must present the original verifier when exchanging the code; intercepting only the code is insufficient.
4. `state` is randomly generated, stored until callback, and compared (links login request to callback — different problem from PKCE).
5. Registered redirect URIs are matched **in full** — no wildcards, no partial match.
6. Tokens never go into the browser address bar.

Obfuscating or splitting a secret inside a public client does not make it confidential. A secret distributed to every user's (or display's) device is never private from those users.

The cleanup job authenticates with Client Credentials; its secret lives in a secret manager or hosting env vars — never in the repository.

**Checkpoint:** Every row marked Public has **No** in “Holds a secret?”.

---

## Keycloak clients (Step 3)

| Client ID | Type | Notes |
|-----------|------|-------|
| `web-client` | Public | Standard flow on; PKCE S256; Direct access grants **off**; redirect e.g. `http://localhost:3000/callback` |
| `mobile-client` | Public | Same pattern; redirect e.g. `http://localhost:3001/callback` |
| `room-display` | Public | Same pattern; redirect e.g. `http://localhost:3002/callback` |
| `cleanup-job` | Confidential | Client auth on; service account on; standard flow off; scope `reservations:cleanup` only |
| `test-cli` | Public (dev-only) | Direct access grants **on** for Step 3 manual password-grant checkpoint only — not a product client |

---

## Six test users (Step 3g)

| User | Role | Used by later negative tests |
|------|------|------------------------------|
| `student-a`, `student-b` | Student | A student must not read another student's reservation |
| `display-a`, `display-b` | Room Display | A display must not act on another room's reservation |
| `student-c`, `student-d` | Student | Extra isolation / list-boundary cases |

The cleanup job uses the **service account** on `cleanup-job`, not a password user.

Default local passwords for these users are set only in local Keycloak / `infra/.env` — never committed.

---

## Scope vocabulary

Canonical table lives in `service/README.md` (Steps 2, 3, 4, and 7 must use the same strings). Summary:

| Scope | Permits |
|-------|---------|
| `rooms:read` | Browse rooms and room details |
| `reservations:read` | Read reservations visible to the principal |
| `reservations:write` | Create and cancel own reservations |
| `rooms:display` | Sync schedule / status for an assigned room |
| `reservations:checkin` | Check a reservation in at a room |
| `reservations:cleanup` | Mark abandoned reservations (e.g. no-show) |

A scope does **not** grant access to every object; Layer 3 (object check) decides visibility.

---

## Service configuration (names only)

Recorded in `service/.env.example`:

- `OIDC_ISSUER` — e.g. `http://localhost:8080/realms/study-reservation`
- `OIDC_JWKS_URI` — e.g. `http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs`
- `OIDC_AUDIENCE` — `study-reservation-api`

---

## Consequences

- Session 3 contract tests remain the baseline; auth middleware (Steps 5–8) must not break operations that already passed.
- CI stays offline from Keycloak via test signing keys.
- Sessions 5–6 web/mobile clients inherit public PKCE classification from this ADR.
- Step 10 can demonstrate refresh rotation + reuse detection on the local realm without waiting on a hosted IdP.
