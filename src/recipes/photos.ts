import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PickedPhoto = { uri: string; width: number; height: number };

const BUCKET = 'recipe-photos';
const MAX_WIDTH = 1600;

/** The camera is only a native feature; on the web the file picker offers it. */
export const cameraAvailable = Platform.OS !== 'web';

export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is turned off. Allow it in your phone settings to take a photo.');
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo access is turned off. Allow it in your phone settings to choose a photo.');
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  }
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Resizes, re-encodes as JPEG, and uploads. Returns the storage path. */
export async function uploadRecipePhoto(householdId: string, recipeId: string, photo: PickedPhoto): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read the photo data.');

  const path = `${householdId}/${recipeId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(out.base64), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Best-effort delete of a replaced photo. Failures are logged, not surfaced. */
export async function removeRecipePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Could not delete old recipe photo', path, error.message);
}

export function useSignedPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

const PARSE_MAX_WIDTH = 1100;

/** Picks up to `max` photos (library) or one (camera). Returns [] when cancelled. */
export async function pickPhotos(source: 'camera' | 'library', max: number): Promise<PickedPhoto[]> {
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is turned off. Allow it in your phone settings to take a photo.');
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo access is turned off. Allow it in your phone settings to choose photos.');
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: max > 1, selectionLimit: max });
  }
  if (result.canceled) return [];
  return result.assets.slice(0, max).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Resizes and re-encodes a photo as JPEG base64 for the recipe reader. */
export async function photoToBase64Jpeg(photo: PickedPhoto): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > PARSE_MAX_WIDTH) ctx.resize({ width: PARSE_MAX_WIDTH });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read the photo data.');
  return out.base64;
}

function randomId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Uploads one import file (base64) under <household>/imports/ and returns its path. */
export async function uploadImportFile(householdId: string, base64: string, mediaType: string, ext: string): Promise<string> {
  const path = `${householdId}/imports/${randomId()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), { contentType: mediaType, upsert: false });
  if (error) throw error;
  return path;
}
