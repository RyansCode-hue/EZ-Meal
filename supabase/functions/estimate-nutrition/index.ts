import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { anthropicClient, describeAnthropicError, MODEL } from '../_shared/claude.ts';

// Estimates per-serving nutrition for one of the household's recipes and stores
// it on the recipe. Estimates, not measurements: the app labels them as such.

const FN = 'estimate-nutrition';

const Output = z.object({
  per_serving: z.object({ calories: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number(), fiber_g: z.number().nullable(), sodium_mg: z.number().nullable() }),
  assumptions: z.array(z.string()),
});

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['per_serving', 'assumptions'],
  properties: {
    per_serving: {
      type: 'object',
      additionalProperties: false,
      required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg'],
      properties: {
        calories: { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        fiber_g: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        sodium_mg: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      },
    },
    assumptions: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short notes on what was assumed (e.g. "olive oil counted fully", "servings taken as 4").' },
  },
} as const;

const SYSTEM = `You estimate nutrition per serving for home recipes from their ingredient list and serving count, using typical USDA-style values. Round calories to the nearest 10 and grams to the nearest 1. If servings are missing, assume 4 and say so in assumptions. Be realistic, not precise.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let recipeId = '';
  try {
    const body = (await req.json()) as { recipe_id?: unknown };
    recipeId = String(body.recipe_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(recipeId)) throw new Error('bad id');
  } catch {
    return json({ error: 'Send JSON with a "recipe_id".' }, 400);
  }

  const { data: recipe, error } = await caller.supabase.from('recipes').select('id, title, servings, recipe_ingredients(quantity, unit, name, preparation)').eq('id', recipeId).maybeSingle();
  if (error) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: error.message }));
    return json({ error: 'Could not load that recipe.' }, 500);
  }
  if (!recipe) return json({ error: 'That recipe was not found.' }, 404);
  const ings = (recipe.recipe_ingredients ?? []) as Array<{ quantity: number | null; unit: string | null; name: string; preparation: string | null }>;
  if (ings.length === 0) return json({ error: 'Add ingredients first; nutrition is estimated from them.' }, 422);

  const text = `Recipe: ${recipe.title}\nServings: ${recipe.servings ?? 'not stated'}\nIngredients:\n` + ings.map((i) => `- ${[i.quantity, i.unit, i.name].filter((x) => x != null && x !== '').join(' ')}${i.preparation ? `, ${i.preparation}` : ''}`).join('\n');

  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: text }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The assistant declined to estimate this recipe.' }, 422);
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    const validated = Output.safeParse(JSON.parse(raw));
    if (!validated.success) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: 'reply failed validation', issues: validated.error.issues.slice(0, 3) }));
      return json({ error: 'The assistant returned something unreadable. Try again.' }, 502);
    }
    const nutrition = { ...validated.data, estimated_at: new Date().toISOString(), model: MODEL };
    const { error: uErr } = await caller.supabase.from('recipes').update({ nutrition }).eq('id', recipeId);
    if (uErr) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: uErr.message }));
      return json({ error: 'Estimated, but could not save it to the recipe.' }, 500);
    }
    console.log(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, recipeId, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return json({ nutrition });
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: message }, status);
  }
});
