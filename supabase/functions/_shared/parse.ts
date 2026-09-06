import type Anthropic from 'npm:@anthropic-ai/sdk';
import { anthropicClient, describeAnthropicError, MODEL } from './claude.ts';
import { ParsedRecipe, RECIPE_JSON_SCHEMA, RECIPE_SYSTEM_PROMPT, toDraft, type RecipeDraft } from './recipeSchema.ts';
import { json } from './http.ts';

// One structuring pass shared by the text, photo, and URL importers. `content`
// is the user-turn content: text blocks, image blocks, or both.
export async function parseRecipe(
  content: Anthropic.MessageParam['content'],
  source: RecipeDraft['source_type'],
  sourceUrl: string | null,
  log: { fn: string; requestId: string; householdId: string },
): Promise<{ draft: RecipeDraft } | { response: Response }> {
  try {
    const response = await anthropicClient().messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: RECIPE_SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: RECIPE_JSON_SCHEMA } },
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason === 'refusal') {
      console.error(JSON.stringify({ ...log, refusal: response.stop_details }));
      return { response: json({ error: 'The recipe assistant declined to read that.' }, 422) };
    }
    if (response.stop_reason === 'max_tokens') {
      return { response: json({ error: 'That recipe is too long to read in one go. Try a shorter piece of it.' }, 422) };
    }
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    let candidate: unknown;
    try {
      candidate = JSON.parse(raw);
    } catch {
      console.error(JSON.stringify({ ...log, error: 'reply was not JSON', head: raw.slice(0, 200) }));
      return { response: json({ error: 'The recipe assistant returned something unreadable. Try again.' }, 502) };
    }
    const validated = ParsedRecipe.safeParse(candidate);
    if (!validated.success) {
      console.error(JSON.stringify({ ...log, error: 'reply failed validation', issues: validated.error.issues.slice(0, 5) }));
      return { response: json({ error: 'The recipe assistant returned an incomplete recipe. Try again.' }, 502) };
    }
    const parsed = validated.data;
    if (!parsed.is_recipe) return { response: json({ error: parsed.problem ?? 'That does not look like a recipe.' }, 422) };
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      return { response: json({ error: 'No ingredients or steps were found.' }, 422) };
    }
    console.log(JSON.stringify({ ...log, ingredients: parsed.ingredients.length, steps: parsed.steps.length, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }));
    return { draft: toDraft(parsed, source, sourceUrl) };
  } catch (e) {
    const [status, message] = describeAnthropicError(e);
    console.error(JSON.stringify({ ...log, error: e instanceof Error ? e.message : String(e) }));
    return { response: json({ error: message }, status) };
  }
}
