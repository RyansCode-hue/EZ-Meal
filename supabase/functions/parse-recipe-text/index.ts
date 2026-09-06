import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { parseRecipe } from '../_shared/parse.ts';

const FN = 'parse-recipe-text';
const MIN_CHARS = 20;
const MAX_CHARS = 20_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let text = '';
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === 'string' ? body.text.trim() : '';
  } catch {
    return json({ error: 'Send JSON with a "text" field.' }, 400);
  }
  if (text.length < MIN_CHARS) return json({ error: 'Paste the whole recipe, including the ingredients.' }, 400);
  if (text.length > MAX_CHARS) return json({ error: 'That is too long for one recipe. Paste one recipe at a time.' }, 400);

  const result = await parseRecipe(text, 'paste', null, { fn: FN, requestId, householdId: caller.householdId });
  if ('response' in result) return result.response;
  return json({ recipe: result.draft });
});
