# Changelog

All notable changes to the OpenAPI contract (`openapi.yaml`) and API specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] - 2026-09-20 (Session 4)

### Added
- OAuth2 Authorization Code and Client Credentials security schemes using Keycloak.
- OAuth2 scopes for room access, reservation access, reservation writes, room display, check-in, and cleanup.
- Authentication requirements for protected room and reservation operations.
- Standard `401 Unauthorized`, `403 Forbidden`, and `404 Not Found` responses for protected operations.

### Changed
- Protected API operations now require authentication and the appropriate OAuth2 scope.
- `/health` remains publicly accessible.

## [0.1.0] - 2026-08-30 (Meeting 2 / Lab L2)

### Added
- Initial contract-first specification for the Study Room Reservation System.
- Resources:
  - `/v1/rooms` and `/v1/rooms/{id}`: Room availability and details.
  - `/v1/reservations` and `/v1/reservations/{id}`: Reservation creation and retrieval.
  - `/v1/reservations/{id}/cancellation`: Reservation cancellation sub-resource.
  - `/health`: System health check endpoint under `system` tag (Assignment A.10).
- RFC 9457 Problem Details for standard HTTP errors (`application/problem+json`).
- `Idempotency-Key` header requirement on `POST /v1/reservations` with 24-hour retention window.
- Defined state machine transitions (`pending_checkin`, `checked_in`, `cancelled`, `no_show`, `completed`).
