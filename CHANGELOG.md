# Changelog

All notable changes to the OpenAPI contract (`openapi.yaml`) and API specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
