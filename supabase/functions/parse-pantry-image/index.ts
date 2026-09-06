import type Anthropic from 'npm:@anthropic-ai/sdk';
import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { anthropicClient, describeAnthropicError, MODEL } from '../_shared/claude.ts';
import { STORE_SECTIONS } from '../_shared/recipeSchema.ts';

// Reads grocery items from a receipt, a fridge shelf, or a pantry shelf photo,
// so the user can tick which ones to add to the pantry.

const FN = 'parse-pantry-image';
const MAX_IMAGES = 3;
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp']);

const Output = z.object({
  is_food: z.boolean(),
  problem: z.string().nullable(),
  items: z.array(
    z.object({
      display_name: z.string().min(1),
      canonical_name: z.string().min(1),
      store_section: z.enum(STORE_SECTIONS),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
    }),
  ),
});

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'problem', 'items'],
  properties: {
    is_food: { type: 'boolean', description: 'False when the photo shows no groceries or food items.' },
    problem: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'When is_food is false, one sentence saying why.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['display_name', 'canonical_name', 'store_section', 'quantity', 'unit'],
        properties: {
          display_name: { type: 'string', description: 'Readable name, e.g. "Whole milk", "Yellow onions".' },
          canonical_name: { type: 'string', description: 'Base grocery item, singular, lowercase, no brand or size: "milk", "onion", "olive oil".' },
          store_section: { type: 'string', enum: [...STORE_SECTIONS] },
          quantity: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Count or amount if visible, else null.' },
          unit: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Short unit if visible: lb, oz, gallon, bag, can, dozen. Null if none.' },
        },
      },
    },
  },
} as const;

const SYSTEM = `You list food and household grocery items visible in photos of receipts, fridge shelves, or pantry shelves.
- From a receipt, read each grocery line item. Skip taxes, totals, coupons, and non-grocery lines. Expand abbreviations ("ORG BNLS CHKN BRST" -> "Boneless chicken breast").
- From a shelf photo, list the items you can identify with reasonable confidence. Skip anything unclear.
- canonical_name is the base item in singular lowercase with no brand or size, the same name for the same item every time.
- Choose store_section from the allowed values.
- If the photo shows no groceries, set is_food false and explain in problem.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let images: Array<{ media_type: string; data: string }> = [];
  try {
    const body = (await req.json()) as { images?: unknown };
    if (!Array.isArray(body.images)) throw new Error('images missing');
    images = body.images;
  } catch {
    return json({ error: 'Send JSON with an "images" array of { media_type, data }.' }, 400);
  }
  if (images.length === 0) return json({ error: 'Add at least one photo.' }, 400);
  if (images.length > MAX_IMAGES) return json({ error: `Up to ${MAX_IMAGES} photos at a time.` }, 400);
  for (const img of images) {
    if (!img || typeof img.data !== 'string' || !MEDIA.has(img.media_type)) return json({ error: 'Each image needs a media_type (JPEG, PNG, WebP) and base64 data.' }, 400);
  }

  const content: Anthropic.MessageParam['content'] = [
    ...images.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.media_type as 'image/jpeg' | 'image/png' | 'image/webp', data: img.data } })),
    { type: 'text', text: 'List the grocery items in these photos.' },
  ];

  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The assistant declined to read that photo.' }, 422);
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    const validated = Output.safeParse(JSON.parse(raw));
    if (!validated.success) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: 'reply failed validation', issues: validated.error.issues.slice(0, 3) }));
      return json({ error: 'The assistant returned something unreadable. Try again.' }, 502);
    }
    const out = validated.data;
    if (!out.is_food) return json({ error: out.problem ?? 'No groceries were found in that photo.' }, 422);
    if (out.items.length === 0) return json({ error: 'No items could be read from that photo. Try a closer, sharper shot.' }, 422);
    console.log(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, items: out.items.length, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return json({ items: out.items.map((i) => ({ ...i, canonical_name: i.canonical_name.trim().toLowerCase(), display_name: i.display_name.trim() })) });
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: message }, status);
  }
});
