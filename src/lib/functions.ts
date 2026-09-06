import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

// One place that turns an Edge Function failure into a sentence for the user.
export async function describeFunctionError(error: unknown, what = 'The assistant'): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return new Error(body.error);
    } catch {
      // Body was not JSON; fall through.
    }
    const status = error.context.status;
    if (status === 413) return new Error(`${what} was sent too much at once. Try fewer or smaller files.`);
    if (status === 504 || status === 546) return new Error(`${what} took too long. Try fewer files at a time.`);
    return new Error(`${what} failed (HTTP ${status}).`);
  }
  if (error instanceof FunctionsRelayError) return new Error(`${what} could not be reached (relay error). Try again.`);
  if (error instanceof FunctionsFetchError) return new Error(`${what} could not be reached. Check your connection, or try fewer or smaller files.`);
  return error instanceof Error ? error : new Error(String(error));
}
