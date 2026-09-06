import type { PostgrestError } from '@supabase/supabase-js';

// Turns a Supabase or generic error into a sentence the user can act on.
export function describeError(error: unknown): string {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  const e = error as Partial<PostgrestError> & { message?: string; code?: string };
  switch (e.code) {
    // Postgres / RPC
    case '23505':
      return 'You are already in a household.';
    case 'P0002':
      return 'That was not found. It may have been removed.';
    case '42501':
      return 'You are not allowed to do that. Sign in again if this keeps happening.';
    case '22023':
      return e.message ?? 'Some of the details are missing.';
    // Auth
    case 'signup_disabled':
      return 'Sign-ups are closed. This app is limited to household members; ask the household owner to add you.';
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Confirm your email first using the link we sent, then sign in.';
    case 'user_already_exists':
      return 'That email already has an account. Sign in instead.';
    case 'weak_password':
      return 'That password is too weak. Use at least 8 characters.';
    case 'email_address_invalid':
      return 'That email address was not accepted. Check it for typos.';
    case 'over_email_send_rate_limit':
      return 'Too many emails sent recently. Wait a few minutes and try again.';
  }
  const msg = e.message ?? '';
  if (/network request failed|failed to fetch|load failed|networkerror/i.test(msg)) {
    return "You're offline. Try again when you're back.";
  }
  return msg || 'Something went wrong.';
}
