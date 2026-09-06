import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/auth/AuthProvider';
import { useHousehold } from '@/household/useHousehold';
import { useDeleteRecipe, useRateRecipe, useRecipe, useRecipes, useUpdateRecipeTags } from '@/recipes/hooks';
import { useEstimateNutrition, type Nutrition } from '@/ideas/hooks';
import { useSignedPhotoUrl } from '@/recipes/photos';
import { formatIngredient, formatMinutes } from '@/recipes/quantity';
import { Chip } from '@/components/Chip';
import { Stars } from '@/components/Stars';
import { Stepper } from '@/components/Stepper';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { BottomSheet } from '@/components/BottomSheet';
import { TextField } from '@/components/TextField';
import { IconButton } from '@/components/IconButton';
import { confirm } from '@/lib/confirm';
import { describeError } from '@/lib/errors';
import { addDays, formatDayLong, startOfWeek, toISODate } from '@/lib/dates';
import { useAddPlanEntry } from '@/plan/hooks';
import { DayPickerSheet } from '@/plan/DayPickerSheet';
import { fonts, colors, maxContentWidth, radius, space, type } from '@/theme/tokens';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { members, household } = useHousehold();
  const addToPlan = useAddPlanEntry();
  const [pickingDay, setPickingDay] = useState(false);
  const [planned, setPlanned] = useState<string | null>(null);
  const planDays = useMemo(() => {
    const start = startOfWeek(new Date(), household?.week_start_day ?? 0);
    return Array.from({ length: 14 }, (_, i) => toISODate(addDays(start, i)));
  }, [household?.week_start_day]);
  const recipe = useRecipe(id);
  const photo = useSignedPhotoUrl(recipe.data?.photo_path);
  const del = useDeleteRecipe();
  const rate = useRateRecipe();
  const [servings, setServings] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const updateTags = useUpdateRecipeTags();
  const estimate = useEstimateNutrition();
  const allRecipes = useRecipes();
  const [addingTag, setAddingTag] = useState(false);
  const [tagText, setTagText] = useState('');

  const r = recipe.data;
  const myRating = r?.recipe_ratings.find((x) => x.user_id === session?.user.id) ?? null;
  useEffect(() => setNotes(myRating?.notes ?? ''), [myRating?.notes]);

  // Tags already used elsewhere in the book, offered as one-tap suggestions.
  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const rec of allRecipes.data ?? []) for (const t of rec.tags) set.add(t);
    return [...set].filter((t) => !r?.tags.includes(t)).sort();
  }, [allRecipes.data, r?.tags]);

  function setTags(tags: string[]) {
    if (!r) return;
    updateTags.mutate({ id: r.id, tags }, { onError: (e) => setError(describeError(e)) });
  }
  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    setTagText('');
    setAddingTag(false);
    if (!t || !r || r.tags.includes(t)) return;
    setTags([...r.tags, t]);
  }

  const baseServings = r?.servings ?? null;
  const shownServings = servings ?? baseServings ?? 1;
  const factor = baseServings ? shownServings / baseServings : 1;

  async function onDelete() {
    if (!r) return;
    const ok = await confirm('Delete recipe?', `"${r.title}" will be removed for both of you.`, 'Delete', true);
    if (!ok) return;
    try {
      await del.mutateAsync(r.id);
      router.back();
    } catch (e) {
      setError(describeError(e));
    }
  }

  function saveRating(rating: number | null, nextNotes: string) {
    if (!r) return;
    rate.mutate({ recipeId: r.id, rating, notes: nextNotes }, { onError: (e) => setError(describeError(e)) });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: r?.title ?? '',
          headerRight: () => (r ? <IconButton icon="create-outline" label="Edit recipe" onPress={() => router.push({ pathname: '/recipes/edit', params: { id: r.id } })} /> : null),
        }}
      />
      {recipe.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : recipe.isError || !r ? (
        <View style={styles.center}>
          <Notice kind="error">{`Could not load this recipe. ${describeError(recipe.error)}`}</Notice>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {r.photo_path ? (
            <View style={styles.hero}>
              {photo.data ? <Image source={{ uri: photo.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
            </View>
          ) : null}
          {error ? <Notice kind="error">{error}</Notice> : null}
          {planned ? <Notice kind="info">{planned}</Notice> : null}

          <View style={styles.section}>
            <Text style={type.title}>{r.title}</Text>
            <Text style={type.bodyMuted}>
              {[
                r.cuisine,
                r.prep_minutes != null ? `${formatMinutes(r.prep_minutes)} prep` : null,
                r.cook_minutes != null ? `${formatMinutes(r.cook_minutes)} cook` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {r.description ? <Text style={type.body}>{r.description}</Text> : null}
            <View style={styles.chips}>
              {r.tags.map((t) => (
                <Chip key={t} label={t} onRemove={() => setTags(r.tags.filter((x) => x !== t))} />
              ))}
              <Chip label="+ tag" onPress={() => setAddingTag(true)} />
            </View>
          </View>

          <View style={styles.card}>
            {baseServings ? (
              <Stepper label="Servings" value={shownServings} min={1} onChange={setServings} />
            ) : (
              <Text style={type.bodyMuted}>Servings not set. Edit the recipe to enable scaling.</Text>
            )}
            {factor !== 1 ? <Text style={type.small}>Amounts scaled from {baseServings} servings.</Text> : null}
            <Button title="Add to plan" variant="secondary" loading={addToPlan.isPending} onPress={() => setPickingDay(true)} />
          </View>

          <View style={styles.section}>
            <Text style={type.heading}>Ingredients</Text>
            {r.recipe_ingredients.length === 0 ? <Text style={type.bodyMuted}>None listed.</Text> : null}
            {r.recipe_ingredients.map((ing) => {
              const f = formatIngredient(ing, factor);
              return (
                <View key={ing.id} style={styles.ingredient}>
                  <Text style={styles.amount}>{f.amount}</Text>
                  <Text style={styles.ingredientName}>
                    {f.name}
                    {f.preparation ? <Text style={type.small}>{`, ${f.preparation}`}</Text> : null}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={type.heading}>Steps</Text>
            {r.recipe_steps.length === 0 ? <Text style={type.bodyMuted}>None listed.</Text> : null}
            {r.recipe_steps.map((step, i) => (
              <View key={step.id} style={styles.step}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
                <Text style={[type.body, { flex: 1 }]}>{step.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={type.label}>Nutrition per serving</Text>
            {(() => {
              const n = r.nutrition as Nutrition | null;
              if (!n?.per_serving) return <Text style={type.small}>Not estimated yet. The estimate comes from the ingredient list and is approximate.</Text>;
              const p = n.per_serving;
              return (
                <>
                  <View style={styles.nutritionRow}>
                    {[
                      [Math.round(p.calories), 'kcal'],
                      [Math.round(p.protein_g), 'g protein'],
                      [Math.round(p.carbs_g), 'g carbs'],
                      [Math.round(p.fat_g), 'g fat'],
                    ].map(([v, l]) => (
                      <View key={String(l)} style={styles.nutritionCell}>
                        <Text style={styles.nutritionValue}>{v}</Text>
                        <Text style={type.small}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={type.small}>{`Estimated${n.assumptions?.length ? `. ${n.assumptions.join(' ')}` : '.'}`}</Text>
                </>
              );
            })()}
            <Button title={r.nutrition ? 'Re-estimate' : 'Estimate nutrition'} variant="secondary" loading={estimate.isPending} onPress={() => estimate.mutate(r.id, { onError: (e) => setError(describeError(e)) })} />
          </View>

          <View style={styles.card}>
            <Text style={type.label}>Your rating</Text>
            <Stars value={myRating?.rating ?? null} size={30} onChange={(v) => saveRating(v, notes)} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes for next time, e.g. more garlic"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.notes}
              accessibilityLabel="Your notes"
            />
            {notes !== (myRating?.notes ?? '') ? (
              <Button title="Save note" variant="secondary" loading={rate.isPending} onPress={() => saveRating(myRating?.rating ?? null, notes)} />
            ) : null}
            {members
              .filter((m) => m.user_id !== session?.user.id)
              .map((m) => {
                const theirs = r.recipe_ratings.find((x) => x.user_id === m.user_id);
                if (!theirs || (theirs.rating == null && !theirs.notes)) return null;
                return (
                  <View key={m.user_id} style={styles.partner}>
                    <Text style={type.label}>{m.display_name}</Text>
                    {theirs.rating != null ? <Stars value={theirs.rating} size={18} /> : null}
                    {theirs.notes ? <Text style={type.body}>{theirs.notes}</Text> : null}
                  </View>
                );
              })}
          </View>

          <Button title="Delete recipe" variant="danger" loading={del.isPending} onPress={onDelete} />
          {r.source_url ? <Text style={[type.small, { textAlign: 'center' }]}>Source: {r.source_url}</Text> : null}
        </ScrollView>
      )}
      <BottomSheet visible={addingTag} onClose={() => setAddingTag(false)} title="Add a tag">
        <TextField
          label="Tag"
          value={tagText}
          onChangeText={setTagText}
          placeholder="e.g. weeknight"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => addTag(tagText)}
        />
        {tagSuggestions.length ? (
          <View style={styles.chips}>
            {tagSuggestions.map((t) => (
              <Chip key={t} label={t} onPress={() => addTag(t)} />
            ))}
          </View>
        ) : null}
        <Button title="Add tag" disabled={!tagText.trim()} onPress={() => addTag(tagText)} />
      </BottomSheet>
      <DayPickerSheet
        visible={pickingDay}
        title="Which day?"
        days={planDays}
        onClose={() => setPickingDay(false)}
        onPick={(date) => {
          setPickingDay(false);
          if (!r) return;
          addToPlan.mutate(
            { date, kind: 'recipe', recipeId: r.id, servings: baseServings ? shownServings : null },
            { onSuccess: () => setPlanned(`Added to ${formatDayLong(date)}.`), onError: (e) => setError(describeError(e)) },
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  hero: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.rule },
  section: { gap: space.sm },
  card: {
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  ingredient: { flexDirection: 'row', gap: space.md, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  amount: { width: 84, fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.accent, fontVariant: ['tabular-nums'] },
  ingredientName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, lineHeight: 22 },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: 6 },
  stepNumber: { width: 28, fontFamily: fonts.heading, fontSize: 18, color: colors.accent, fontVariant: ['tabular-nums'] },
  notes: {
    minHeight: 72,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.md,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  partner: { gap: space.xs, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  nutritionRow: { flexDirection: 'row', gap: space.sm },
  nutritionCell: { flex: 1, alignItems: 'center', paddingVertical: space.sm, backgroundColor: colors.ground, borderRadius: radius.md },
  nutritionValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, fontVariant: ['tabular-nums'] },
});
