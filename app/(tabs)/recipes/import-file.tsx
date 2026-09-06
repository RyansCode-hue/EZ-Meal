import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useParseRecipeFiles } from '@/recipes/hooks';
import { cameraAvailable, photoToBase64Jpeg, pickPhotos, uploadImportFile, type PickedPhoto } from '@/recipes/photos';
import { useHousehold } from '@/household/useHousehold';
import { pickDocuments, type PickedFile } from '@/recipes/files';
import { stashDraft } from '@/recipes/draftStore';
import { describeError } from '@/lib/errors';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

const MAX_ITEMS = 10;

type Item = { kind: 'photo'; photo: PickedPhoto } | { kind: 'file'; file: PickedFile };

function fileIcon(mediaType: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (mediaType === 'application/pdf') return 'document-text-outline';
  if (mediaType.includes('wordprocessingml')) return 'document-outline';
  if (mediaType.startsWith('image/')) return 'image-outline';
  return 'reader-outline';
}

export default function ImportFile() {
  const router = useRouter();
  const parse = useParseRecipeFiles();
  const { household } = useHousehold();
  const [items, setItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const room = MAX_ITEMS - items.length;

  async function addPhotos(source: 'camera' | 'library') {
    setError(null);
    try {
      const picked = await pickPhotos(source, room);
      setItems((cur) => [...cur, ...picked.map((photo) => ({ kind: 'photo' as const, photo }))].slice(0, MAX_ITEMS));
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function addFiles() {
    setError(null);
    try {
      const picked = await pickDocuments(room);
      setItems((cur) => [...cur, ...picked.map((file) => ({ kind: 'file' as const, file }))].slice(0, MAX_ITEMS));
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function onRead() {
    if (!household) return;
    setError(null);
    setPreparing(true);
    try {
      // Files go to the household's private bucket one at a time, so the read
      // request itself stays tiny no matter how many pages there are.
      const uploaded = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setProgress(`Uploading ${i + 1} of ${items.length}…`);
        if (it.kind === 'photo') {
          const data = await photoToBase64Jpeg(it.photo);
          uploaded.push({ path: await uploadImportFile(household.id, data, 'image/jpeg', 'jpg'), name: `photo-${i + 1}.jpg`, media_type: 'image/jpeg' });
        } else {
          const ext = it.file.name.split('.').pop()?.toLowerCase() || 'bin';
          uploaded.push({ path: await uploadImportFile(household.id, it.file.data, it.file.media_type, ext), name: it.file.name, media_type: it.file.media_type });
        }
      }
      setProgress(null);
      setPreparing(false);
      const draft = await parse.mutateAsync(uploaded);
      stashDraft(draft);
      router.replace({ pathname: '/recipes/edit', params: { draft: '1' } });
    } catch (e) {
      setProgress(null);
      setPreparing(false);
      setError(describeError(e));
    }
  }

  const busy = preparing || parse.isPending;

  return (
    <>
      <Stack.Screen options={{ title: 'Photo or file' }} />
      <Screen scroll header>
        <Text style={type.bodyMuted}>A photo of a recipe card or cookbook page, a screenshot, a PDF, a Word document, or a text file. Add more than one if the recipe runs across pages.</Text>
        {error ? <Notice kind="error">{error}</Notice> : null}
        {items.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {items.map((it, i) => (
              <View key={i} style={styles.tile}>
                {it.kind === 'photo' ? (
                  <Image source={{ uri: it.photo.uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.fileTile}>
                    <Ionicons name={fileIcon(it.file.media_type)} size={30} color={colors.accent} />
                    <Text style={styles.fileName} numberOfLines={3}>
                      {it.file.name}
                    </Text>
                  </View>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${i + 1}`} onPress={() => setItems((cur) => cur.filter((_, j) => j !== i))} style={styles.remove}>
                  <Ionicons name="close" size={16} color={colors.accentInk} />
                </Pressable>
                <Text style={styles.pageNo}>{i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-attach-outline" size={36} color={colors.ruleStrong} />
            <Text style={type.bodyMuted}>Nothing added yet</Text>
          </View>
        )}
        {room > 0 ? (
          <View style={styles.row}>
            {cameraAvailable ? <Button title="Take photo" variant="secondary" onPress={() => addPhotos('camera')} style={{ flex: 1 }} disabled={busy} /> : null}
            <Button title="Photos" variant="secondary" onPress={() => addPhotos('library')} style={{ flex: 1 }} disabled={busy} />
            <Button title="Files" variant="secondary" onPress={addFiles} style={{ flex: 1 }} disabled={busy} />
          </View>
        ) : (
          <Text style={type.small}>That is the most items for one recipe.</Text>
        )}
        <Text style={type.small}>Photos, PDF, Word, text, Markdown, or a saved web page. Up to 10 items, 8 MB each.</Text>
        <Button title={progress ?? (preparing ? 'Preparing…' : parse.isPending ? 'Reading your recipe…' : 'Read recipe')} onPress={onRead} loading={busy} disabled={items.length === 0} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.sm, paddingVertical: 2 },
  tile: { width: 120, height: 160, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.rule },
  thumb: { width: '100%', height: '100%' },
  fileTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.sm, backgroundColor: colors.surface },
  fileName: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink, textAlign: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(27,35,30,0.7)', alignItems: 'center', justifyContent: 'center' },
  pageNo: { position: 'absolute', left: 8, bottom: 6, color: colors.accentInk, fontSize: 12, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  empty: { height: 160, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
});
