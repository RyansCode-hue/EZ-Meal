import Anthropic from 'npm:@anthropic-ai/sdk';

// Which Claude model the recipe features use. Override without a redeploy:
//   supabase secrets set CLAUDE_MODEL=claude-sonnet-5
// Per parsed recipe (about 1.5K tokens in, 800 out): Opus 5 ~3 cents,
// Sonnet 5 ~1 cent, Haiku 4.5 ~0.5 cents.
export const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';

export function anthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set for this function. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...');
  }
  // Organization-level keys carry no workspace, so the API needs one named per
  // request. Workspace-scoped keys work without it.
  const workspaceId = Deno.env.get('ANTHROPIC_WORKSPACE_ID')?.trim();
  return new Anthropic({ apiKey, defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined });
}

// Maps SDK errors to something the app can show. Returns [status, message].
export function describeAnthropicError(e: unknown): [number, string] {
  if (e instanceof Anthropic.AuthenticationError) return [500, 'The recipe assistant is not configured correctly (API key rejected).'];
  if (e instanceof Anthropic.RateLimitError) return [429, 'The recipe assistant is busy. Try again in a minute.'];
  if (e instanceof Anthropic.APIConnectionError) return [502, 'Could not reach the recipe assistant. Check your connection and try again.'];
  // The API's own message names the bad field; it is safe to show and saves a trip to the logs.
  if (e instanceof Anthropic.APIError) return [502, `The recipe assistant returned an error (${e.status}): ${e.message}`];
  if (e instanceof Error && e.message.startsWith('ANTHROPIC_API_KEY')) return [500, 'The recipe assistant is not set up yet (missing API key).'];
  return [500, 'The recipe assistant failed. Try again.'];
}
