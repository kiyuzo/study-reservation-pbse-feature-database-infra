# Local authorisation server (Keycloak) — P4 Step 3

The Study Room Reservation API is the **resource server**: it never receives passwords and never issues tokens. Keycloak issues access tokens; the service verifies them via JWKS.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Free host port **8080** for Keycloak (when both Keycloak and the API run, set the API `PORT` / `BASE_URL` to something else, e.g. `3000`)

## Start

```bash
cd infra
cp .env.example .env
# Edit .env and set KC_ADMIN_PASSWORD (required)

docker compose -f docker-compose.auth.yml up -d
```

Admin console: http://localhost:8080  
Realm: **`study-reservation`** (imported from `keycloak/import/study-reservation-realm.json`)

## Discovery (record into service/.env)

```bash
curl -s http://localhost:8080/realms/study-reservation/.well-known/openid-configuration ^
  | jq "{issuer, jwks_uri}"
```

Typical local values for `service/.env`:

```env
OIDC_ISSUER=http://localhost:8080/realms/study-reservation
OIDC_JWKS_URI=http://localhost:8080/realms/study-reservation/protocol/openid-connect/certs
OIDC_AUDIENCE=study-reservation-api
```

## Manual token checkpoint (Step 3)

Dev-only client `test-cli` has Direct Access Grants enabled for local inspection — not a product client.

```bash
# PowerShell-friendly: set ISSUER and password, then:
curl -s -X POST "$ISSUER/protocol/openid-connect/token" `
  -d "grant_type=password" `
  -d "client_id=test-cli" `
  -d "username=student-a" `
  -d "password=<from-infra-.env-TEST_USER_PASSWORD>" `
  -d "scope=openid rooms:read"

# Decode payload locally only (do not paste tokens into online tools):
# take the JWT middle segment, base64url-decode, inspect iss/aud/exp/sub/scope
```

## What the realm import includes

- Client scopes matching `service/README.md` (`rooms:read`, `reservations:*`, …)
- Public clients: `web-client`, `mobile-client`, `room-display`, `test-cli`
- Confidential client: `cleanup-job` (service account; scope `reservations:cleanup`)
  - Local-only client secret in the realm JSON: `local-dev-cleanup-job-secret` (never reuse in production; production secret lives in the host secret manager)
- Client scope `study-reservation-api-audience` with:
  - Audience mapper → `aud: study-reservation-api`
  - Subject mapper (`oidc-sub-mapper`) → `sub` on access tokens (Keycloak 26+ no longer puts `sub` on tokens unless the `basic` scope or an explicit mapper is present; import cannot reliably reference built-in scopes by name alone)
- Refresh token rotation + reuse detection (`revokeRefreshToken: true`, `refreshTokenMaxReuse: 0`)
- Six test users: `student-a` … `student-d`, `display-a`, `display-b` (password `changeme-test`)

Decisions and rationale: [`docs/decisions/0003-autentikasi.md`](../docs/decisions/0003-autentikasi.md).
