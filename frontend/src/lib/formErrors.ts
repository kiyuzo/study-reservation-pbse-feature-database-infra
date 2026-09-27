import { ProblemError } from '../api/client';
import type { ProblemDetails } from '../types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BookingField = 'roomId' | 'date' | 'startTime' | 'endTime';
export type BookingFieldErrors = Partial<Record<BookingField | 'form', string>>;

export interface BookingInput {
  roomId?: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** Client-side booking checks (UX only; service remains the enforcer). */
export function validateBookingInput(input: BookingInput): BookingFieldErrors {
  const errors: BookingFieldErrors = {};

  if (!input.roomId?.trim()) {
    errors.roomId = 'Choose a study room before booking.';
  }
  if (!input.date?.trim()) {
    errors.date = 'Pick a reservation date.';
  } else if (!DATE_RE.test(input.date)) {
    errors.date = 'Date must be YYYY-MM-DD.';
  }
  if (!input.startTime?.trim()) {
    errors.startTime = 'Enter a start time.';
  } else if (!TIME_RE.test(input.startTime)) {
    errors.startTime = 'Start time must be HH:MM (24-hour).';
  }
  if (!input.endTime?.trim()) {
    errors.endTime = 'Enter an end time.';
  } else if (!TIME_RE.test(input.endTime)) {
    errors.endTime = 'End time must be HH:MM (24-hour).';
  }

  if (
    !errors.startTime &&
    !errors.endTime &&
    input.startTime &&
    input.endTime &&
    input.endTime <= input.startTime
  ) {
    errors.endTime = 'End time must be after start time.';
  }

  return errors;
}

export function validateCancelReason(reason: string): string | null {
  if (reason === undefined || reason === null) {
    return 'A cancellation reason is required.';
  }
  // Backend accepts empty string if the field is present; require non-empty for UX.
  if (!String(reason).trim()) {
    return 'Please explain why you are cancelling this booking.';
  }
  return null;
}

/** Map Problem Details extensions onto booking form fields. */
export function mapProblemToBookingFields(problem: ProblemDetails): BookingFieldErrors {
  const errors: BookingFieldErrors = {};
  const known: BookingField[] = ['roomId', 'date', 'startTime', 'endTime'];

  if (problem.fields) {
    for (const [key, message] of Object.entries(problem.fields)) {
      if ((known as string[]).includes(key)) {
        errors[key as BookingField] = message;
      } else {
        errors.form = errors.form || message;
      }
    }
  }

  if (problem.invalidParams) {
    for (const param of problem.invalidParams) {
      if ((known as string[]).includes(param.name)) {
        errors[param.name as BookingField] = param.reason;
      } else {
        errors.form = errors.form || param.reason;
      }
    }
  }

  if (Object.keys(errors).length === 0 && problem.status === 422) {
    errors.form = domainMessageFromProblem(problem);
  }

  return errors;
}

/** Domain-facing copy for toasts and error panels (PDF A.6). */
export function domainMessageFromProblem(problem: ProblemDetails): string {
  const type = problem.type || '';

  if (type.includes('room-unavailable')) {
    return problem.detail || 'That room is already booked for this time. Pick another slot.';
  }
  if (type.includes('idempotency-key-reuse')) {
    return problem.detail || 'This Idempotency-Key was already used with a different booking. Generate a new key and try again.';
  }
  if (type.includes('illegal-transition')) {
    const from = problem.from ? ` (current status: ${problem.from})` : '';
    return problem.detail || `That action is not allowed for this reservation${from}.`;
  }
  if (type.includes('forbidden') || problem.status === 403) {
    return problem.detail || 'Your account does not have permission for this action.';
  }
  if (type.includes('unauthorized') || problem.status === 401) {
    return problem.detail || 'You are not signed in. Sign in is required to continue.';
  }
  if (type.includes('not-found') || problem.status === 404) {
    return problem.detail || 'That room or reservation was not found.';
  }
  if (type.includes('network-error') || problem.status === 0) {
    return problem.detail || 'Could not reach the reservation service. Check that it is running.';
  }
  if (type.includes('validation-failed') || problem.status === 422) {
    return problem.detail || problem.title || 'This booking cannot be completed as entered.';
  }
  if (problem.status === 400) {
    return problem.detail || 'One or more fields are invalid. Fix them and try again.';
  }

  return problem.detail || problem.title || 'Something went wrong with this request.';
}

export function problemFromUnknown(err: unknown): ProblemDetails {
  if (err instanceof ProblemError) {
    return err.problem;
  }
  if (err && typeof err === 'object' && 'problem' in err) {
    return (err as ProblemError).problem;
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return {
    type: 'https://api.library.example/problems/unknown-error',
    title: 'Unexpected Error',
    status: 500,
    detail: message
  };
}

export function hasFieldErrors(errors: BookingFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
