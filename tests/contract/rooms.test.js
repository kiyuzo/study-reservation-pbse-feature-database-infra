/**
 * ============================================================================
 * CONTRACT TESTS — Study Room Resource
 * Owned by: PERSON 2 / PERSON 4
 * ============================================================================
 * Tests contract conformance against openapi.yaml:
 * 1. GET /v1/rooms - returns 200 with list of rooms conforming to Room schema
 * 2. GET /v1/rooms - returns 200 with empty array [] when no rooms match (not 404)
 * 3. GET /v1/rooms/{id} - returns 200 with room representation
 * 4. GET /v1/rooms/{id} - returns 400 for malformed ID format (RFC 9457)
 * 5. GET /v1/rooms/{id} - returns 404 for non-existent room ID (RFC 9457)
 * 6. Query parameters validation - unknown parameters produce 400
 * ============================================================================
 */

const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.BASE_URL = 'http://localhost:8080';
process.env.DATABASE_PATH = path.resolve(__dirname, '../../service/db/reservation.sqlite');

const app = require('../../service/src/app');

describe('Rooms Contract Conformance Tests (openapi.yaml)', () => {
  describe('GET /v1/rooms', () => {
    it('returns 200 and a collection conforming to Room schema', async () => {
      const response = await request(app).get('/v1/rooms');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      response.body.forEach((room) => {
        expect(room).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^rm_[A-Za-z0-9]{3,}$/),
            name: expect.any(String),
            capacity: expect.any(Number),
            location: expect.any(String),
            createdAt: expect.any(String)
          })
        );
        expect(room.capacity).toBeGreaterThanOrEqual(1);
      });
    });

    it('rejects unknown query parameters with 400 Problem Details', async () => {
      const response = await request(app).get('/v1/rooms?unexpectedParam=true');

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(response.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          title: expect.any(String),
          status: 400
        })
      );
    });
  });

  describe('GET /v1/rooms/:roomId', () => {
    it('returns 200 with single room representation matching contract schema', async () => {
      const response = await request(app).get('/v1/rooms/rm_1a2B3cD');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: 'rm_1a2B3cD',
          name: 'Study Room A',
          capacity: 4,
          location: 'Library Floor 1 - Wing A',
          createdAt: expect.any(String)
        })
      );
    });

    it('returns 400 Bad Request with RFC 9457 Problem Details for malformed ID', async () => {
      const response = await request(app).get('/v1/rooms/invalid_room_id!');

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(response.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/malformed-request',
          title: expect.any(String),
          status: 400,
          detail: expect.any(String),
          instance: '/v1/rooms/invalid_room_id!'
        })
      );
    });

    it('returns 404 Not Found with RFC 9457 Problem Details for non-existent room', async () => {
      const response = await request(app).get('/v1/rooms/rm_nonexistent999');

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(response.body).toEqual(
        expect.objectContaining({
          type: 'https://api.library.example/problems/not-found',
          title: 'Resource not found',
          status: 404,
          instance: '/v1/rooms/rm_nonexistent999'
        })
      );
    });
  });
});
