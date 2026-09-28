import type { Room, Reservation, Cancellation, ProblemDetails, SecurityEvent, DemoPersona } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

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

// ---------------------------------------------------------------------------
// ETag & Conditional Request Cache (A.7 & A.8)
// ---------------------------------------------------------------------------

export interface CacheEntry<T = unknown> {
  etag: string;
  data: T;
  lastUpdated: Date;
}

// Map<resourceUrl, { etag, data, lastUpdated }> persists across polling cycles & re-renders
const etagCache = new Map<string, CacheEntry>();

export function getResourceCacheEntry<T = unknown>(path: string): CacheEntry<T> | undefined {
  const normalized = normalizePath(path);
  return etagCache.get(normalized) as CacheEntry<T> | undefined;
}

export function getResourceEtag(path: string): string | null {
  const normalized = normalizePath(path);
  return etagCache.get(normalized)?.etag || null;
}

export function getReservationEtag(reservationId: string): string | null {
  const exact = etagCache.get(`/v1/reservations/${reservationId}`);
  if (exact?.etag) return exact.etag;

  // Also check if cached under list / collection
  const listEntry = etagCache.get('/v1/reservations');
  if (listEntry?.data && typeof listEntry.data === 'object' && 'items' in (listEntry.data as Record<string, unknown>)) {
    const items = (listEntry.data as { items: (Reservation & { _etag?: string })[] }).items;
    const item = items.find((r) => r.id === reservationId);
    if (item && item._etag) return item._etag;
  }

  return null;
}

export function setReservationEtag(reservationId: string, etag: string, data?: unknown) {
  const path = `/v1/reservations/${reservationId}`;
  const existing = etagCache.get(path);
  etagCache.set(path, {
    etag,
    data: data || existing?.data || null,
    lastUpdated: new Date()
  });
}

export function getLastSyncTime(path: string): Date | null {
  const normalized = normalizePath(path);
  return etagCache.get(normalized)?.lastUpdated || null;
}

export function clearEtagCache() {
  etagCache.clear();
}

function normalizePath(path: string): string {
  return '/' + path.replace(/^\/+/, '');
}

export interface ApiFetchOptions extends RequestInit {
  etag?: string;
  skipEtag?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  customHeaders: Record<string, string> = {}
): Promise<T> {
  const normalizedPath = normalizePath(path);
  const requestId = customHeaders['X-Request-ID'] || crypto.randomUUID();
  const method = (options.method || 'GET').toUpperCase();

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

  // 1. Conditional Reads (GET): Attach If-None-Match if an ETag is cached
  if (method === 'GET' && !options.skipEtag && !headers['If-None-Match']) {
    const cached = etagCache.get(normalizedPath);
    if (cached && cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }
  }

  // 2. Conditional Writes (POST/PUT/PATCH/DELETE): Attach If-Match if specified
  if (method !== 'GET') {
    if (options.etag && !headers['If-Match']) {
      headers['If-Match'] = options.etag;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${normalizedPath}`, {
      ...options,
      headers
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not connect to the Study Reservation backend service.';
    throw new ProblemError(
      {
        type: 'https://api.library.example/problems/network-error',
        title: 'Network Communication Error',
        status: 0,
        detail: message,
        requestId
      },
      requestId
    );
  }

  const returnedRequestId = response.headers.get('X-Request-ID') || requestId;
  lastRequestId = returnedRequestId;

  const etagHeader = response.headers.get('ETag');
  const contentType = response.headers.get('content-type') || '';

  // -------------------------------------------------------------------------
  // Handle 304 Not Modified (A.7: Successful read, preserve existing data)
  // -------------------------------------------------------------------------
  if (response.status === 304) {
    const cached = etagCache.get(normalizedPath);
    if (cached) {
      cached.lastUpdated = new Date();
      if (etagHeader) {
        cached.etag = etagHeader;
      }
      return cached.data as T;
    }
    return {} as T;
  }

  // -------------------------------------------------------------------------
  // Handle HTTP Errors (!response.ok)
  // -------------------------------------------------------------------------
  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

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

    // Explicit domain explanation for 412 Precondition Failed (A.8)
    if (response.status === 412) {
      problem.type = problem.type || 'https://api.library.example/problems/precondition-failed';
      problem.title = problem.title || 'Precondition Failed';
      problem.detail = problem.detail || 'This reservation has already been updated. The latest reservation details are shown below.';
    }

    problem.requestId = returnedRequestId;
    throw new ProblemError(problem, returnedRequestId);
  }

  // -------------------------------------------------------------------------
  // Successful 200/201 Response: Parse & Update ETag Cache
  // -------------------------------------------------------------------------
  let data: T = {} as T;
  if (contentType.includes('application/json')) {
    data = (await response.json()) as T;
  }

  if (etagHeader) {
    etagCache.set(normalizedPath, {
      etag: etagHeader,
      data,
      lastUpdated: new Date()
    });

    // If writing or reading a single reservation, also index by its canonical entity path
    if (normalizedPath.startsWith('/v1/reservations/') && !normalizedPath.includes('cancellation') && !normalizedPath.includes('checkin')) {
      const reservationId = normalizedPath.split('/')[3];
      if (reservationId) {
        setReservationEtag(reservationId, etagHeader, data);
      }
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Room Endpoints
// ---------------------------------------------------------------------------

export async function fetchRooms(options?: { forceRefresh?: boolean }): Promise<Room[]> {
  return apiFetch<Room[]>('/v1/rooms', {
    skipEtag: options?.forceRefresh
  });
}

export async function fetchRoomById(roomId: string, options?: { forceRefresh?: boolean }): Promise<Room> {
  return apiFetch<Room>(`/v1/rooms/${encodeURIComponent(roomId)}`, {
    skipEtag: options?.forceRefresh
  });
}

// ---------------------------------------------------------------------------
// Reservation Endpoints
// ---------------------------------------------------------------------------

export async function fetchReservations(
  status?: string,
  options?: { forceRefresh?: boolean }
): Promise<{ items: Reservation[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<{ items: Reservation[] }>(`/v1/reservations${query}`, {
    skipEtag: options?.forceRefresh
  });
}

export async function fetchReservationById(
  reservationId: string,
  options?: { forceRefresh?: boolean }
): Promise<Reservation> {
  return apiFetch<Reservation>(`/v1/reservations/${encodeURIComponent(reservationId)}`, {
    skipEtag: options?.forceRefresh
  });
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

export interface WriteActionOptions {
  idempotencyKey?: string;
  etag?: string;
}

export async function cancelReservation(
  reservationId: string,
  reason: string,
  options?: WriteActionOptions | string
): Promise<Cancellation> {
  const key = typeof options === 'string'
    ? options
    : options?.idempotencyKey || crypto.randomUUID();

  // Attach passed ETag, or fallback to cached entity ETag
  const etag = typeof options === 'object' && options?.etag
    ? options.etag
    : getReservationEtag(reservationId) || undefined;

  return apiFetch<Cancellation>(
    `/v1/reservations/${encodeURIComponent(reservationId)}/cancellation`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
      etag
    },
    {
      'Idempotency-Key': key
    }
  );
}

export async function checkInReservation(
  reservationId: string,
  options?: WriteActionOptions | string
): Promise<Reservation> {
  const key = typeof options === 'string'
    ? options
    : options?.idempotencyKey || crypto.randomUUID();

  const etag = typeof options === 'object' && options?.etag
    ? options.etag
    : getReservationEtag(reservationId) || undefined;

  return apiFetch<Reservation>(
    `/v1/reservations/${encodeURIComponent(reservationId)}/checkin`,
    {
      method: 'POST',
      etag
    },
    {
      'Idempotency-Key': key
    }
  );
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
