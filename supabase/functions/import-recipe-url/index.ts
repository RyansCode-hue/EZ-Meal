import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { parseRecipe } from '../_shared/parse.ts';
import { decodeEntities, htmlToText } from '../_shared/text.ts';

// Imports a recipe from a web page. Most recipe sites publish schema.org Recipe
// data as JSON-LD; when present that clean text is what gets structured.
// Otherwise the page's visible text is used. The recipe photo, when the page
// names one, is copied into the household's private bucket.

const FN = 'import-recipe-url';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML = 3_000_000;
const MAX_TEXT = 40_000;
const UA = 'Mozilla/5.0 (compatible; EZMealBot/1.0; +https://ez-meal.expo.app)';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let url: URL;
  try {
    const body = (await req.json()) as { url?: unknown };
    url = new URL(String(body.url ?? '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad scheme');
    if (isPrivateHost(url.hostname)) throw new Error('private host');
  } catch {
    return json({ error: 'That does not look like a web address. Paste the full link, starting with https://.' }, 400);
  }

  // Fetch the page.
  let html = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, url: url.href, status: res.status }));
      return json({ error: `The site answered with an error (${res.status}). Some sites block automated readers; paste the recipe text instead.` }, 422);
    }
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('xml')) return json({ error: 'That link is not a web page. Paste a link to the recipe page itself.' }, 422);
    html = (await res.text()).slice(0, MAX_HTML);
  } catch (e) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, url: url.href, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'Could not load that page. Check the link, or paste the recipe text instead.' }, 422);
  }

  const ld = extractRecipeJsonLd(html);
  const text = ld ? jsonLdToText(ld) : htmlToText(html);
  if (text.trim().length < 40) return json({ error: 'No readable recipe text was found on that page. Paste the recipe text instead.' }, 422);

  const prompt = (ld ? 'Structured recipe data from the page:\n\n' : 'Text of a web page that should contain a recipe. Ignore navigation, comments, and ads:\n\n') + text.slice(0, MAX_TEXT);
  const result = await parseRecipe(prompt, 'url', url.href, { fn: FN, requestId, householdId: caller.householdId });
  if ('response' in result) return result.response;

  // Best-effort photo: copy the page's recipe image into the household bucket.
  const imageUrl = ld ? firstImageUrl(ld.image) : null;
  if (imageUrl) {
    try {
      const imgRes = await fetch(new URL(imageUrl, url), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      const ctype = imgRes.headers.get('content-type') ?? '';
      if (imgRes.ok && /^image\/(jpeg|png|webp)/.test(ctype)) {
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        if (bytes.byteLength <= 8 * 1024 * 1024) {
          const ext = ctype.includes('png') ? 'png' : ctype.includes('webp') ? 'webp' : 'jpg';
          const path = `${caller.householdId}/import-${crypto.randomUUID()}.${ext}`;
          const { error } = await caller.supabase.storage.from('recipe-photos').upload(path, bytes, { contentType: ctype.split(';')[0] });
          if (error) console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, error: `photo upload: ${error.message}` }));
          else result.draft.photo_path = path;
        }
      }
    } catch (e) {
      console.warn(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, warn: `photo fetch: ${e instanceof Error ? e.message : String(e)}` }));
    }
  }

  return json({ recipe: result.draft });
});

// ---------------------------------------------------------------------------

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return h.includes(':'); // bare IPv6 literal: refuse
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

type JsonLd = Record<string, unknown>;

function extractRecipeJsonLd(html: string): JsonLd | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const found = findRecipe(data);
    if (found) return found;
  }
  return null;
}

function findRecipe(node: unknown, depth = 0): JsonLd | null {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === 'object') {
    const obj = node as JsonLd;
    const type = obj['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) return obj;
    if (obj['@graph']) return findRecipe(obj['@graph'], depth + 1);
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const r = findRecipe(v, depth + 1);
        if (r) return r;
      }
    }
  }
  return null;
}

function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return decodeEntities(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join('\n');
  if (typeof v === 'object') {
    const o = v as JsonLd;
    return asText(o.text ?? o.name ?? o['@value'] ?? '');
  }
  return String(v);
}

function jsonLdToText(r: JsonLd): string {
  const lines: string[] = [];
  const push = (label: string, v: unknown) => {
    const t = asText(v).trim();
    if (t) lines.push(`${label}: ${t}`);
  };
  push('Title', r.name);
  push('Description', r.description);
  push('Yield', r.recipeYield);
  push('Prep time', r.prepTime);
  push('Cook time', r.cookTime);
  push('Total time', r.totalTime);
  push('Cuisine', r.recipeCuisine);
  push('Category', r.recipeCategory);
  push('Keywords', r.keywords);
  const ings = asText(r.recipeIngredient).trim();
  if (ings) lines.push('Ingredients:\n' + ings);
  const steps = flattenInstructions(r.recipeInstructions);
  if (steps.length) lines.push('Steps:\n' + steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  return lines.join('\n\n');
}

function flattenInstructions(v: unknown, out: string[] = []): string[] {
  if (!v) return out;
  if (typeof v === 'string') {
    for (const part of decodeEntities(v).split(/\n+/)) if (part.trim()) out.push(part.trim());
    return out;
  }
  if (Array.isArray(v)) {
    for (const item of v) flattenInstructions(item, out);
    return out;
  }
  if (typeof v === 'object') {
    const o = v as JsonLd;
    if (o.itemListElement) return flattenInstructions(o.itemListElement, out);
    const t = asText(o.text ?? o.name);
    if (t.trim()) out.push(t.trim());
  }
  return out;
}

function firstImageUrl(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstImageUrl(v[0]);
  if (typeof v === 'object') {
    const o = v as JsonLd;
    return typeof o.url === 'string' ? o.url : typeof o.contentUrl === 'string' ? o.contentUrl : null;
  }
  return null;
}
