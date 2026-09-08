# Service Implementation — Study Room Reservation API

This directory contains the backend implementation for the Study Room Reservation System (PBSE Week 3).

## 🚀 Deployed URL
- **Production URL:** *[To be added after deployment]*
- **Health Check:** `[Deployment URL]/health`

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
