import type { Room, Reservation, Cancellation, ProblemDetails, SecurityEvent, DemoPersona } from '../types';

let currentAuthToken: string | null = null;
let lastRequestId: string = '';

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export function getLastRequestId(): string {
  return lastRequestId;
}

export class ProblemError extends Error {
  problem: ProblemDetails;
  status: number;
  requestId: string;

  constructor(problem: ProblemDetails, requestId: string) {
    super(problem.detail || problem.title || 'API Error');
    this.name = 'ProblemError';
    this.problem = problem;
    this.status = problem.status || 500;
    this.requestId = requestId;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  customHeaders: Record<string, string> = {}
): Promise<T> {
  const requestId = customHeaders['X-Request-ID'] || crypto.randomUUID();
  const headers: Record<string, string> = {
    'Accept': 'application/json, application/problem+json',
    'X-Request-ID': requestId,
    ...customHeaders
  };

  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers
    });
  } catch (err: any) {
    // Network or connection failure
    throw new ProblemError(
      {
        type: 'https://api.library.example/problems/network-error',
        title: 'Network Communication Error',
        status: 0,
        detail: err.message || 'Could not connect to the Study Reservation backend service.',
        requestId
      },
      requestId
    );
  }

  const returnedRequestId = response.headers.get('X-Request-ID') || requestId;
  lastRequestId = returnedRequestId;

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let problem: ProblemDetails;
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      try {
        problem = await response.json();
      } catch {
        problem = {
          type: 'https://api.library.example/problems/unknown-error',
          title: response.statusText,
          status: response.status,
          detail: 'Failed to parse response error payload.'
        };
      }
    } else {
      const text = await response.text();
      problem = {
        type: 'https://api.library.example/problems/raw-error',
        title: response.statusText,
        status: response.status,
        detail: text || 'An error occurred.'
      };
    }

    problem.requestId = returnedRequestId;
    throw new ProblemError(problem, returnedRequestId);
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
}

// ---------------------------------------------------------------------------
// Room Endpoints
// ---------------------------------------------------------------------------

export async function fetchRooms(): Promise<Room[]> {
  return apiFetch<Room[]>('/v1/rooms');
}

export async function fetchRoomById(roomId: string): Promise<Room> {
  return apiFetch<Room>(`/v1/rooms/${encodeURIComponent(roomId)}`);
}

// ---------------------------------------------------------------------------
// Reservation Endpoints
// ---------------------------------------------------------------------------

export async function fetchReservations(status?: string): Promise<{ items: Reservation[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<{ items: Reservation[] }>(`/v1/reservations${query}`);
}

export async function fetchReservationById(reservationId: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/v1/reservations/${encodeURIComponent(reservationId)}`);
}

export interface CreateReservationPayload {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export async function createReservation(
  payload: CreateReservationPayload,
  idempotencyKey?: string
): Promise<Reservation> {
  const key = idempotencyKey || crypto.randomUUID();

  return apiFetch<Reservation>(
    '/v1/reservations',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    {
      'Idempotency-Key': key
    }
  );
}

export async function cancelReservation(
  reservationId: string,
  reason: string
): Promise<Cancellation> {
  return apiFetch<Cancellation>(`/v1/reservations/${encodeURIComponent(reservationId)}/cancellation`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function checkInReservation(reservationId: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/v1/reservations/${encodeURIComponent(reservationId)}/checkin`, {
    method: 'POST'
  });
}

// ---------------------------------------------------------------------------
// Security & Audit Demo Endpoints
// ---------------------------------------------------------------------------

export async function fetchSecurityEvents(limit: number = 50): Promise<{ count: number; events: SecurityEvent[] }> {
  return apiFetch<{ count: number; events: SecurityEvent[] }>(`/v1/security/events?limit=${limit}`);
}

export async function fetchDemoTokens(): Promise<Record<string, DemoPersona>> {
  return apiFetch<Record<string, DemoPersona>>('/v1/security/demo-tokens');
}

export async function fetchCurrentPrincipal(): Promise<{
  authenticated: boolean;
  principal: { subject: string; kind: string; scopes: string[]; tokenId: string } | null;
  requestId: string;
}> {
  return apiFetch('/v1/security/me');
}
