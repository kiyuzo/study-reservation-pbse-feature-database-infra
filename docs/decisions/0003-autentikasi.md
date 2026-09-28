# Decision 0003 — Autentikasi dan Refresh Token Rotation

## Status

Implemented and manually verified against the local Keycloak realm.

## Authorization server

- Provider: Keycloak 26.0
- Realm: `study-reservation`
- Token endpoint:
  `http://localhost:8080/realms/study-reservation/protocol/openid-connect/token`
- Test client: `test-cli`
- Test user: `student-a`

## Refresh-token rotation and reuse detection

The realm import configures the following settings:

| Keycloak setting | Value |
|---|---|
| `revokeRefreshToken` | `true` |
| `refreshTokenMaxReuse` | `0` |

These settings enable refresh-token rotation and disallow reuse of an already-used refresh token.

### Manual verification (Step 10b)

Three consecutive requests were performed against the local Keycloak token endpoint.

| Request | Observed result | Outcome |
|---|---|---|
| 1. Exchange RT1 for RT2 | A new refresh token was returned; RT2 differed from RT1. | PASS |
| 2. Reuse RT1 | `invalid_grant` — `Maximum allowed refresh token reuse exceeded` | PASS |
| 3. Use RT2 after RT1 reuse | `invalid_grant` — `Session doesn't have required client` | PASS |

The third request was rejected after RT1 reuse. The observed response confirms RT2 could no longer be used in this test sequence.

No raw access-token or refresh-token values are stored in this decision record.

## Token handling

The service acts as a resource server. Keycloak issues tokens; the service does not receive user passwords or issue refresh tokens.

For browser-based clients, the refresh token must be stored in a protected `HttpOnly`, `Secure`, `SameSite` cookie, not in `localStorage`. Access tokens should be short-lived and kept in memory where possible.

## Evidence and limitations

- Realm configuration: `infra/keycloak/import/study-reservation-realm.json`
- Manual verification was performed against the local Keycloak instance.
- The three request results above are recorded from the terminal output.
- This is manual verification; it is not an automated CI test.
