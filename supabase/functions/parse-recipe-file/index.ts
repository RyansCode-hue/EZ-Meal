import type Anthropic from 'npm:@anthropic-ai/sdk';
import { json, preflight } from '../_shared/http.ts';
import { requireHouseholdMember } from '../_shared/auth.ts';
import { parseRecipe } from '../_shared/parse.ts';
import { base64ToBytes, docxToText, htmlToText } from '../_shared/text.ts';

// Reads a recipe from files: photos, PDFs, Word documents, plain text,
// Markdown, or saved web pages. Several files are read together as one recipe.

const FN = 'parse-recipe-file';
const MAX_FILES = 5;
const MAX_BYTES_EACH = 8 * 1024 * 1024;
const MAX_TEXT = 40_000;

const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const TEXTY = new Set(['text/plain', 'text/markdown', 'text/html', 'application/xhtml+xml']);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type FileIn = { name?: string; media_type: string; data: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const requestId = crypto.randomUUID();
  const caller = await requireHouseholdMember(req, FN, requestId);
  if (caller instanceof Response) return caller;

  let files: FileIn[] = [];
  try {
    const body = (await req.json()) as { files?: unknown };
    if (!Array.isArray(body.files)) throw new Error('files missing');
    files = body.files as FileIn[];
  } catch {
    return json({ error: 'Send JSON with a "files" array of { name, media_type, data }.' }, 400);
  }
  if (files.length === 0) return json({ error: 'Add at least one photo or file.' }, 400);
  if (files.length > MAX_FILES) return json({ error: `Up to ${MAX_FILES} files per recipe.` }, 400);

  const content: Anthropic.MessageParam['content'] = [];
  const kinds: string[] = [];
  for (const f of files) {
    if (!f || typeof f.data !== 'string' || typeof f.media_type !== 'string') return json({ error: 'Each file needs a media_type and base64 data.' }, 400);
    if (f.data.length * 0.75 > MAX_BYTES_EACH) return json({ error: `"${f.name ?? 'A file'}" is too large. Files up to 8 MB work.` }, 400);
    const type = f.media_type.split(';')[0].trim().toLowerCase();
    try {
      if (IMAGE.has(type)) {
        content.push({ type: 'image', source: { type: 'base64', media_type: type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: f.data } });
        kinds.push('photo');
      } else if (type === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
        kinds.push('PDF');
      } else if (type === DOCX || (f.name ?? '').toLowerCase().endsWith('.docx')) {
        const text = docxToText(base64ToBytes(f.data)).slice(0, MAX_TEXT);
        content.push({ type: 'text', text: `Contents of ${f.name ?? 'a Word document'}:\n\n${text}` });
        kinds.push('Word document');
      } else if (TEXTY.has(type) || /\.(txt|md|markdown|html?)$/i.test(f.name ?? '')) {
        const raw = new TextDecoder().decode(base64ToBytes(f.data));
        const text = (type.includes('html') || /\.html?$/i.test(f.name ?? '') ? htmlToText(raw) : raw).slice(0, MAX_TEXT);
        content.push({ type: 'text', text: `Contents of ${f.name ?? 'a text file'}:\n\n${text}` });
        kinds.push('text');
      } else {
        return json({ error: `"${f.name ?? type}" is not a supported type. Use photos, PDF, Word, text, Markdown, or a saved web page.` }, 400);
      }
    } catch (e) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: caller.householdId, file: f.name, error: e instanceof Error ? e.message : String(e) }));
      return json({ error: `Could not read "${f.name ?? 'that file'}". ${e instanceof Error ? e.message : ''}`.trim() }, 422);
    }
  }
  content.push({
    type: 'text',
    text: files.length > 1 ? `These ${files.length} files are parts of one recipe, in order. Read them together as a single recipe.` : 'Read the recipe in this file.',
  });

  const source = kinds.every((k) => k === 'photo') ? 'photo' : 'paste';
  const result = await parseRecipe(content, source, null, { fn: FN, requestId, householdId: caller.householdId });
  if ('response' in result) return result.response;
  return json({ recipe: result.draft });
});
