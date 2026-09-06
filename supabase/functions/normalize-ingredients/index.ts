import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { anthropicClient, describeAnthropicError, MODEL } from '../_shared/claude.ts';
import { STORE_SECTIONS } from '../_shared/recipeSchema.ts';

// Assigns a grocery-list name and store section to ingredients typed by hand,
// so manual recipes merge and sort on the grocery list like imported ones.

const FN = 'normalize-ingredients';
const MAX_ITEMS = 60;

const Input = z.object({
  ingredients: z.array(z.object({ name: z.string().min(1), preparation: z.string().nullable().optional() })).min(1).max(MAX_ITEMS),
});

const Output = z.object({
  ingredients: z.array(z.object({ canonical_name: z.string().min(1), store_section: z.enum(STORE_SECTIONS) })),
});

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ingredients'],
  properties: {
    ingredients: {
      type: 'array',
      description: 'One entry per input ingredient, in the same order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['canonical_name', 'store_section'],
        properties: {
          canonical_name: { type: 'string', description: 'Base grocery item, singular, lowercase, no brand, quantity, or prep: "onion", "chicken thigh", "olive oil".' },
          store_section: { type: 'string', enum: [...STORE_SECTIONS] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You label recipe ingredients for a grocery list.
For each input ingredient, give canonical_name (the base grocery item, singular, lowercase, no brand, size, quantity, or preparation; the same item always gets the same name) and store_section (where it is found in a typical US grocery store).
Fresh herbs are produce; dried herbs and spices are spices; butter, milk, cheese, eggs are dairy_eggs; oils, flour, sugar, rice, pasta, and dry goods are pantry.
Return exactly one entry per input, in the same order.`;

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
    return json({ error: `Send JSON with an "ingredients" array of 1 to ${MAX_ITEMS} items, each with a name.` }, 400);
  }

  const list = input.ingredients.map((i, n) => `${n + 1}. ${i.name}${i.preparation ? ` (${i.preparation})` : ''}`).join('\n');

  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: list }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The assistant declined to label these ingredients.' }, 422);
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    const validated = Output.safeParse(JSON.parse(raw));
    if (!validated.success || validated.data.ingredients.length !== input.ingredients.length) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: 'reply shape mismatch', got: validated.success ? validated.data.ingredients.length : validated.error.issues.slice(0, 3) }));
      return json({ error: 'The assistant returned an incomplete answer. Try again.' }, 502);
    }
    console.log(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, items: input.ingredients.length, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return json({ ingredients: validated.data.ingredients.map((i) => ({ canonical_name: i.canonical_name.trim().toLowerCase(), store_section: i.store_section })) });
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: message }, status);
  }
});
