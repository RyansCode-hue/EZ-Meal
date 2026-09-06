import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { anthropicClient, describeAnthropicError, MODEL } from '../_shared/claude.ts';
import { ParsedRecipe, RECIPE_JSON_SCHEMA, toDraft } from '../_shared/recipeSchema.ts';

// "Ask" on the Ideas tab. The household's recipe titles and pantry are loaded
// here (under RLS) so the assistant suggests from what they actually have,
// and any new recipe it proposes comes back as a full draft to save.

const FN = 'suggest-meals';
const MAX_TURNS = 8;
const MAX_CHARS = 2000;

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(MAX_CHARS) })).min(1).max(MAX_TURNS),
});

const Output = z.object({
  reply: z.string(),
  existing: z.array(z.object({ recipe_id: z.string(), why: z.string() })),
  new_recipes: z.array(ParsedRecipe),
});

// Reuse the recipe schema for new suggestions so they save through the same path.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'existing', 'new_recipes'],
  properties: {
    reply: { type: 'string', description: 'A short, friendly answer (one to three sentences). Mention suggestions by name.' },
    existing: {
      type: 'array',
      description: 'Recipes from the household book that fit, best first. Up to 3.',
      items: { type: 'object', additionalProperties: false, required: ['recipe_id', 'why'], properties: { recipe_id: { type: 'string', description: 'The id exactly as listed.' }, why: { type: 'string', description: 'One short reason it fits.' } } },
    },
    new_recipes: { type: 'array', description: 'Up to 2 new recipes, complete and cookable, when the book has no good fit or the user asks for something new.', items: RECIPE_JSON_SCHEMA },
  },
} as const;

function systemPrompt(recipes: string, pantry: string) {
  return `You help a two-person household decide what to cook. Be brief and practical.

Their recipe book (id | title | tags | total minutes | last cooked):
${recipes || '(empty)'}

Their pantry (item: status):
${pantry || '(nothing tracked)'}

Rules:
- Prefer recipes from their book when they fit the request; reference them by id in "existing" and explain briefly why.
- Suggest new recipes only when the book has no good fit or they ask for something new. New recipes must be complete: ingredients with quantities, canonical_name and store_section per ingredient, numbered steps, servings, and times. Follow the same conventions as a recipe importer: units short (cup, tbsp, tsp, oz, lb, g), canonical_name singular lowercase base item.
- Favor what is in the pantry, and avoid recipes cooked in the last two weeks unless asked.
- Keep "reply" to one to three sentences; the cards carry the details.`;
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

  const [{ data: recipes, error: rErr }, { data: pantry, error: pErr }] = await Promise.all([
    caller.supabase.from('recipes').select('id, title, tags, prep_minutes, cook_minutes, last_cooked_at').order('title'),
    caller.supabase.from('pantry_items').select('display_name, status').order('display_name'),
  ]);
  if (rErr || pErr) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: rErr?.message ?? pErr?.message }));
    return json({ error: 'Could not load your recipes and pantry.' }, 500);
  }
  const recipeLines = (recipes ?? [])
    .map((r) => {
      const mins = r.prep_minutes == null && r.cook_minutes == null ? '?' : String((r.prep_minutes ?? 0) + (r.cook_minutes ?? 0));
      const last = r.last_cooked_at ? new Date(r.last_cooked_at).toISOString().slice(0, 10) : 'never';
      return `${r.id} | ${r.title} | ${(r.tags ?? []).join(', ') || '-'} | ${mins} | ${last}`;
    })
    .join('\n');
  const pantryLines = (pantry ?? []).map((p) => `${p.display_name}: ${p.status}`).join('\n');
  const known = new Set((recipes ?? []).map((r) => r.id));

  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt(recipeLines, pantryLines),
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
    console.log(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, existing: out.existing.length, new: out.new_recipes.length, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return json({
      reply: out.reply,
      existing: out.existing.filter((e) => known.has(e.recipe_id)).slice(0, 3),
      new_recipes: out.new_recipes.filter((r) => r.is_recipe).slice(0, 2).map((r) => toDraft(r, 'ai')),
    });
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: message }, status);
  }
});
