export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  roomId: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status: 'pending_checkin' | 'checked_in' | 'cancelled' | 'no_show' | 'completed';
  createdAt: string;
  userId?: string;
  cancellable?: boolean;
  canCheckIn?: boolean;
  _links?: Record<string, { href: string; method?: string }>;
}

export interface Cancellation {
  reservationId: string;
  reason?: string;
  cancelledAt: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  fields?: Record<string, string>;
  from?: string;
  to?: string;
  allowedFrom?: string[];
  requestId?: string;
}

export interface SecurityEvent {
  timestamp: string;
  event: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED' | string;
  requestId: string;
  clientIp?: string;
  method?: string;
  path?: string;
  principal?: {
    subject?: string;
    kind?: string;
    scopes?: string[];
  } | null;
  resource?: {
    reservationId?: string;
    roomId?: string;
  } | null;
  detail?: string | null;
  tokenFingerprint?: string | null;
}

export interface DemoPersona {
  name: string;
  subject: string;
  role: string;
  scopes: string[];
  description: string;
  token?: string;
  tokenFingerprint?: string;
  label?: string;
}

export interface Principal {
  subject: string;
  kind: string;
  scopes: string[];
  tokenId?: string;
}
