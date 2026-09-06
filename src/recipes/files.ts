import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

export type PickedFile = { name: string; media_type: string; data: string; sizeBytes: number };

export const FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/html',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_BYTES = 8 * 1024 * 1024;

function guessType(name: string, given?: string | null): string {
  if (given && given !== 'application/octet-stream') return given;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return (
    { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', html: 'text/html', htm: 'text/html', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] ?? 'application/octet-stream'
  );
}

/** Lets the person choose up to `max` documents and returns them as base64. */
export async function pickDocuments(max: number): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, multiple: max > 1, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const out: PickedFile[] = [];
  for (const asset of result.assets.slice(0, max)) {
    const media_type = guessType(asset.name, asset.mimeType);
    if ((asset.size ?? 0) > MAX_BYTES) throw new Error(`"${asset.name}" is larger than 8 MB. Try a smaller file or a photo of the page.`);
    let data: string;
    if (Platform.OS === 'web' && asset.file) {
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Could not read "${asset.name}".`));
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.readAsDataURL(asset.file as Blob);
      });
    } else {
      data = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
    }
    out.push({ name: asset.name, media_type, data, sizeBytes: asset.size ?? Math.round(data.length * 0.75) });
  }
  return out;
}
