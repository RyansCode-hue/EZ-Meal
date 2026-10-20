import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getPreview, markPreviewSaved, usePreviewStore } from '@/recipes/draftStore';
import { useSaveRecipe } from '@/recipes/hooks';
import { IngredientList, StepList, recipeMetaLine } from '@/recipes/RecipeParts';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { describeError } from '@/lib/errors';
import { colors, maxContentWidth, radius, space, type } from '@/theme/tokens';

// A recipe the assistant wrote, shown read-only until someone saves it.
export default function RecipePreview() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const router = useRouter();
  usePreviewStore();
  const held = getPreview(key);
  const save = useSaveRecipe();
  const [error, setError] = useState<string | null>(null);

  if (!held || !key) {
    return (
      <>
        <Stack.Screen options={{ title: 'Idea' }} />
        <EmptyState icon="sparkles-outline" title="This idea is gone" body="Ideas from the assistant last until the page reloads. Ask again on the Ideas tab." />
        <View style={styles.footer}>
          <Button title="Back to Ideas" variant="secondary" onPress={() => router.replace('/ideas')} />
        </View>
      </>
    );
  }

  const d = held.draft;
  const meta = [recipeMetaLine(d), d.servings ? `Serves ${d.servings}` : null].filter(Boolean).join(' · ');

  async function onSave() {
    if (!key || !held) return;
    setError(null);
    try {
      const id = await save.mutateAsync(held.draft);
      markPreviewSaved(key, id);
      router.replace(`/recipes/${id}`);
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Idea' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={type.title}>{d.title}</Text>
          {meta ? <Text style={type.bodyMuted}>{meta}</Text> : null}
          {d.description ? <Text style={type.body}>{d.description}</Text> : null}
          {d.tags.length ? (
            <View style={styles.chips}>
              {d.tags.map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          ) : null}
        </View>

        {held.savedId ? (
          <Notice kind="info">Already saved to your recipes.</Notice>
        ) : (
          <Notice kind="info">New recipe from the assistant. It is not in your recipes until you save it.</Notice>
        )}
        {d.warnings?.length ? <Notice kind="warn">{d.warnings.join(' ')}</Notice> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}

        <IngredientList ingredients={d.ingredients} />
        <StepList steps={d.steps} />

        <View style={styles.card}>
          {held.savedId ? (
            <Button title="Open saved recipe" onPress={() => router.replace(`/recipes/${held.savedId}`)} />
          ) : (
            <Button title="Save as a recipe" loading={save.isPending} onPress={onSave} />
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  card: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule },
  footer: { padding: space.lg, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
});
