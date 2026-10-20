import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember, type Caller } from '../_shared/auth.ts';
import { anthropicClient, describeAnthropicError, MODEL } from '../_shared/claude.ts';
import { ParsedRecipe, RECIPE_JSON_SCHEMA, toDraft } from '../_shared/recipeSchema.ts';

// The meal chat on the Ideas tab. The household's recipes, pantry, and notes
// are loaded here (under RLS) so the assistant suggests from what they have
// and follows what it has been told. New recipes come back as full drafts.
// Lasting facts the user states ("we don't like spicy food") are saved as
// household notes, which every later chat reads.

const FN = 'suggest-meals';
const MAX_TURNS = 24;
const MAX_CHARS = 6000;
const MAX_NEW_NOTES = 3;
const MAX_NOTES = 60;
const MAX_NOTE_CHARS = 200;

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(MAX_CHARS) })).min(1).max(MAX_TURNS),
});

const Output = z.object({
  reply: z.string(),
  existing: z.array(z.object({ recipe_id: z.string(), why: z.string() })),
  new_recipes: z.array(ParsedRecipe),
  remember: z.array(z.string()),
});

// Reuse the recipe schema for new suggestions so they save through the same path.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'existing', 'new_recipes', 'remember'],
  properties: {
    reply: { type: 'string', description: 'A short, conversational answer. Mention suggestions by name. Ask a brief follow-up question when it would help narrow things down.' },
    existing: {
      type: 'array',
      description: 'Recipes from the household book that fit, best first. Up to 3.',
      items: { type: 'object', additionalProperties: false, required: ['recipe_id', 'why'], properties: { recipe_id: { type: 'string', description: 'The id exactly as listed.' }, why: { type: 'string', description: 'One short reason it fits.' } } },
    },
    new_recipes: { type: 'array', description: 'Up to 2 new recipes, complete and cookable, when the book has no good fit, the user asks for something new, asks to build a dish around an ingredient, or asks to change a recipe suggested earlier.', items: RECIPE_JSON_SCHEMA },
    remember: {
      type: 'array',
      description: 'Lasting facts about the household stated by the user in their latest message: tastes, dislikes, allergies, diet, equipment, schedule, who eats. Each a short third-person sentence, e.g. "Does not like spicy food." Empty when there is nothing new, when it is a one-off preference for tonight, or when it is already in the notes.',
      items: { type: 'string' },
    },
  },
} as const;

function systemPrompt(recipes: string, pantry: string, notes: string) {
  return `You help a two-person household decide what to cook. Be brief, warm, and practical. This is an ongoing chat: build on earlier turns, and when they ask to change something you suggested, return the revised recipe.

What you know about this household (always follow these):
${notes || '(nothing yet)'}

Their recipe book (id | title | tags | total minutes | last cooked):
${recipes || '(empty)'}

Their pantry (item: status):
${pantry || '(nothing tracked)'}

Rules:
- Prefer recipes from their book when they fit the request; reference them by id in "existing" and explain briefly why.
- Suggest new recipes only when the book has no good fit or they ask for something new. New recipes must be complete: ingredients with quantities, canonical_name and store_section per ingredient, numbered steps, servings, and times. Follow the same conventions as a recipe importer: units short (cup, tbsp, tsp, oz, lb, g), canonical_name singular lowercase base item.
- Favor what is in the pantry, and avoid recipes cooked in the last two weeks unless asked.
- When they ask for a dish built around an ingredient (a meat, a vegetable, something in the pantry), return one or two new recipes that feature it, plus any fitting book recipes in "existing".
- Earlier assistant turns end with a bracketed list of the recipes shown; use it to know what "that one" or "the second one" means.
- Keep "reply" to one to four sentences; the cards carry the details.
- Put a fact in "remember" only when the user states something lasting about the household. Never invent one, and never store a fact that is already listed above.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let input: z.infer<typeof Input>;
  try {
    input = Input.parse(await req.json());
  } catch {
    return json({ error: 'Send JSON with a "messages" array of { role, content }.' }, 400);
  }
  if (input.messages[input.messages.length - 1].role !== 'user') return json({ error: 'The last message must be from the user.' }, 400);

  const [{ data: recipes, error: rErr }, { data: pantry, error: pErr }, { data: notes, error: nErr }] = await Promise.all([
    caller.supabase.from('recipes').select('id, title, tags, prep_minutes, cook_minutes, last_cooked_at').order('title'),
    caller.supabase.from('pantry_items').select('display_name, status').order('display_name'),
    caller.supabase.from('household_notes').select('text').order('created_at'),
  ]);
  if (rErr || pErr || nErr) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: rErr?.message ?? pErr?.message ?? nErr?.message }));
    return json({ error: 'Could not load your recipes, pantry, and notes.' }, 500);
  }
  const recipeLines = (recipes ?? [])
    .map((r) => {
      const mins = r.prep_minutes == null && r.cook_minutes == null ? '?' : String((r.prep_minutes ?? 0) + (r.cook_minutes ?? 0));
      const last = r.last_cooked_at ? new Date(r.last_cooked_at).toISOString().slice(0, 10) : 'never';
      return `${r.id} | ${r.title} | ${(r.tags ?? []).join(', ') || '-'} | ${mins} | ${last}`;
    })
    .join('\n');
  const pantryLines = (pantry ?? []).map((p) => `${p.display_name}: ${p.status}`).join('\n');
  const noteTexts = (notes ?? []).map((n) => n.text as string);
  const noteLines = noteTexts.map((t) => `- ${t}`).join('\n');
  const known = new Set((recipes ?? []).map((r) => r.id));

  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt(recipeLines, pantryLines, noteLines),
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: input.messages,
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The assistant declined that request.' }, 422);
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    const validated = Output.safeParse(JSON.parse(raw));
    if (!validated.success) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: 'reply failed validation', issues: validated.error.issues.slice(0, 3) }));
      return json({ error: 'The assistant returned something unreadable. Try again.' }, 502);
    }
    const out = validated.data;
    const { remembered, rememberError } = await saveNotes(caller, out.remember, noteTexts, requestId);
    console.log(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, existing: out.existing.length, new: out.new_recipes.length, remembered: remembered.length, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return json({
      reply: out.reply,
      existing: out.existing.filter((e) => known.has(e.recipe_id)).slice(0, 3),
      new_recipes: out.new_recipes.filter((r) => r.is_recipe).slice(0, 2).map((r) => toDraft(r, 'ai')),
      remembered,
      remember_error: rememberError,
    });
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: message }, status);
  }
});

// Saves new household facts from this turn, skipping near-duplicates of what is
// already known. A failed save does not fail the chat; the app shows the error.
async function saveNotes(
  caller: Caller,
  proposed: string[],
  existing: string[],
  requestId: string,
): Promise<{ remembered: Array<{ id: string; text: string }>; rememberError: string | null }> {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const seen = new Set(existing.map(norm));
  const fresh: string[] = [];
  for (const raw of proposed) {
    const text = raw.trim().slice(0, MAX_NOTE_CHARS);
    if (!text || seen.has(norm(text))) continue;
    seen.add(norm(text));
    fresh.push(text);
  }
  const room = Math.max(0, MAX_NOTES - existing.length);
  const toSave = fresh.slice(0, Math.min(MAX_NEW_NOTES, room));
  if (toSave.length === 0) {
    return { remembered: [], rememberError: fresh.length && room === 0 ? `The notes list is full (${MAX_NOTES}). Remove a few to let the assistant remember more.` : null };
  }
  const { data, error } = await caller.supabase
    .from('household_notes')
    .insert(toSave.map((text) => ({ household_id: caller.householdId, text, source: 'chat', created_by: caller.userId })))
    .select('id, text');
  if (error) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: `note insert failed: ${error.message}` }));
    return { remembered: [], rememberError: `Could not save what you told me: ${error.message}` };
  }
  return { remembered: (data ?? []) as Array<{ id: string; text: string }>, rememberError: null };
}
