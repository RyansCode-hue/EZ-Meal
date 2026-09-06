import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { IconButton } from '@/components/IconButton';
import { useHousehold } from '@/household/useHousehold';
import { useNormalizeIngredients, useRecipe, useSaveRecipe, useSetRecipePhoto } from '@/recipes/hooks';
import { cameraAvailable, pickPhoto, removeRecipePhoto, uploadRecipePhoto, useSignedPhotoUrl, type PickedPhoto } from '@/recipes/photos';
import { takeDraft } from '@/recipes/draftStore';
import { formatQuantity, parseQuantity } from '@/recipes/quantity';
import { draftFromDetail, emptyDraft, type RecipeDraft, type StoreSection } from '@/recipes/types';
import { confirm } from '@/lib/confirm';
import { describeError } from '@/lib/errors';
import { colors, radius, space, tapTarget, type } from '@/theme/tokens';

// Form state keeps numbers as text so partially typed values ("1 1/") survive re-renders.
type IngredientForm = {
  key: number;
  quantityText: string;
  unit: string;
  name: string;
  preparation: string;
  canonical_name?: string | null;
  store_section?: StoreSection | null;
};
type StepForm = { key: number; text: string };
type Form = {
  id?: string;
  title: string;
  description: string;
  prepText: string;
  cookText: string;
  servingsText: string;
  cuisine: string;
  tagsText: string;
  source_type: RecipeDraft['source_type'];
  source_url: string | null;
  photo_path: string | null;
  ingredients: IngredientForm[];
  steps: StepForm[];
  warnings: string[];
};

let keySeq = 1;
const nextKey = () => keySeq++;

function toForm(d: RecipeDraft): Form {
  return {
    id: d.id,
    title: d.title,
    description: d.description ?? '',
    prepText: d.prep_minutes != null ? String(d.prep_minutes) : '',
    cookText: d.cook_minutes != null ? String(d.cook_minutes) : '',
    servingsText: d.servings != null ? formatQuantity(d.servings) : '',
    cuisine: d.cuisine ?? '',
    tagsText: d.tags.join(', '),
    source_type: d.source_type,
    source_url: d.source_url,
    photo_path: d.photo_path,
    ingredients: (d.ingredients.length ? d.ingredients : [{ quantity: null, unit: null, name: '', preparation: null }]).map((i) => ({
      key: nextKey(),
      quantityText: formatQuantity(i.quantity),
      unit: i.unit ?? '',
      name: i.name,
      preparation: i.preparation ?? '',
      canonical_name: i.canonical_name,
      store_section: i.store_section,
    })),
    steps: (d.steps.length ? d.steps : [{ text: '' }]).map((s) => ({ key: nextKey(), text: s.text })),
    warnings: d.warnings ?? [],
  };
}

function parseIntField(text: string, label: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number of minutes.`);
  return n;
}

function toDraft(f: Form): RecipeDraft {
  const servings = parseQuantity(f.servingsText);
  if (f.servingsText.trim() && servings == null) throw new Error('Servings must be a number.');
  if (servings != null && servings <= 0) throw new Error('Servings must be greater than zero.');
  const ingredients = f.ingredients
    .filter((i) => i.name.trim())
    .map((i) => {
      const quantity = parseQuantity(i.quantityText);
      if (i.quantityText.trim() && quantity == null) throw new Error(`Could not read the amount "${i.quantityText}" for ${i.name.trim()}. Use numbers like 2, 1.5, or 1/2.`);
      return {
        quantity,
        unit: i.unit.trim() || null,
        name: i.name.trim(),
        preparation: i.preparation.trim() || null,
        canonical_name: i.canonical_name ?? null,
        store_section: i.store_section ?? null,
      };
    });
  return {
    id: f.id,
    title: f.title.trim(),
    description: f.description.trim() || null,
    photo_path: f.photo_path,
    prep_minutes: parseIntField(f.prepText, 'Prep time'),
    cook_minutes: parseIntField(f.cookText, 'Cook time'),
    servings,
    cuisine: f.cuisine.trim() || null,
    tags: f.tagsText
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    source_type: f.source_type,
    source_url: f.source_url,
    ingredients,
    steps: f.steps.map((s) => ({ text: s.text.trim() })).filter((s) => s.text),
  };
}

export default function RecipeEdit() {
  const { id, draft: fromDraft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  const router = useRouter();
  const { household } = useHousehold();
  const existing = useRecipe(id);
  const save = useSaveRecipe();
  const setPhoto = useSetRecipePhoto();
  const normalize = useNormalizeIngredients();
  const [form, setForm] = useState<Form | null>(() => {
    if (id) return null;
    const stashed = fromDraft ? takeDraft() : null;
    return toForm(stashed ?? emptyDraft('manual'));
  });
  const [localPhoto, setLocalPhoto] = useState<PickedPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existingPhoto = useSignedPhotoUrl(removePhoto ? null : form?.photo_path);

  useEffect(() => {
    if (id && existing.data && !form) setForm(toForm(draftFromDetail(existing.data)));
  }, [id, existing.data, form]);

  const update = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function choosePhoto(source: 'camera' | 'library') {
    try {
      const picked = await pickPhoto(source);
      if (picked) {
        setLocalPhoto(picked);
        setRemovePhoto(false);
      }
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function onSave() {
    if (!form || !household) return;
    setError(null);
    if (!form.title.trim()) return setError('Give the recipe a title.');
    let draft: RecipeDraft;
    try {
      draft = toDraft(form);
    } catch (e) {
      return setError(describeError(e));
    }
    if (removePhoto) draft.photo_path = null;

    setBusy(true);
    try {
      // Hand-typed ingredients get a grocery name and store section so they merge
      // on the grocery list. If that fails, the cook decides whether to save anyway.
      const unlabeled = draft.ingredients.map((ing, i) => ({ ing, i })).filter(({ ing }) => !ing.canonical_name || !ing.store_section);
      if (unlabeled.length) {
        try {
          const labels = await normalize.mutateAsync(unlabeled.map(({ ing }) => ({ name: ing.name, preparation: ing.preparation })));
          unlabeled.forEach(({ i }, n) => {
            draft.ingredients[i] = { ...draft.ingredients[i], ...labels[n] };
          });
        } catch (e) {
          const ok = await confirm('Could not sort ingredients', `${describeError(e)}\n\nSave anyway? They will show under "Other" on the grocery list until you edit the recipe again.`, 'Save anyway');
          if (!ok) {
            setBusy(false);
            return;
          }
        }
      }
      const savedId = await save.mutateAsync(draft);
      const previousPath = form.photo_path;
      if (localPhoto) {
        try {
          const path = await uploadRecipePhoto(household.id, savedId, localPhoto);
          await setPhoto.mutateAsync({ id: savedId, photo_path: path });
          if (previousPath && previousPath !== path) void removeRecipePhoto(previousPath);
        } catch (e) {
          setError(`The recipe was saved, but the photo did not upload: ${describeError(e)}`);
          setBusy(false);
          return;
        }
      } else if (removePhoto && previousPath) {
        void removeRecipePhoto(previousPath);
      }
      if (id) router.back();
      else router.replace(`/recipes/${savedId}`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPhotoPress() {
    if (!cameraAvailable) return choosePhoto('library');
    const useCamera = await confirm('Add a photo', 'Take a new photo, or choose one from your library?', 'Take photo');
    return choosePhoto(useCamera ? 'camera' : 'library');
  }

  const title = id ? 'Edit recipe' : fromDraft ? 'Check the import' : 'New recipe';

  if (!form) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <View style={styles.center}>
          {existing.isError ? <Notice kind="error">{`Could not load this recipe. ${describeError(existing.error)}`}</Notice> : <ActivityIndicator color={colors.accent} size="large" />}
        </View>
      </>
    );
  }

  const showingPhoto = localPhoto?.uri ?? (existingPhoto.data && !removePhoto ? existingPhoto.data : null);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen scroll header>
        {form.warnings.length ? <Notice kind="warn">{`Worth a look: ${form.warnings.join(' ')}`}</Notice> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}

        <Pressable accessibilityRole="button" accessibilityLabel={showingPhoto ? 'Change photo' : 'Add photo'} onPress={onPhotoPress} style={styles.photoBox}>
          {showingPhoto ? (
            <Image source={{ uri: showingPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.photoEmpty}>
              <Ionicons name="camera-outline" size={28} color={colors.muted} />
              <Text style={type.bodyMuted}>Add a photo</Text>
            </View>
          )}
        </Pressable>
        {showingPhoto ? (
          <View style={styles.photoActions}>
            <Button title="Change photo" variant="secondary" onPress={onPhotoPress} style={{ flex: 1 }} />
            <Button
              title="Remove"
              variant="secondary"
              onPress={() => {
                setLocalPhoto(null);
                setRemovePhoto(true);
              }}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        <TextField label="Title" value={form.title} onChangeText={(v) => update({ title: v })} autoCapitalize="sentences" />
        <TextField label="Description" value={form.description} onChangeText={(v) => update({ description: v })} multiline hint="Optional" />
        <View style={styles.rowFields}>
          <TextField label="Prep min" value={form.prepText} onChangeText={(v) => update({ prepText: v })} keyboardType="number-pad" style={styles.smallField} />
          <TextField label="Cook min" value={form.cookText} onChangeText={(v) => update({ cookText: v })} keyboardType="number-pad" style={styles.smallField} />
          <TextField label="Servings" value={form.servingsText} onChangeText={(v) => update({ servingsText: v })} keyboardType="decimal-pad" style={styles.smallField} />
        </View>
        <TextField label="Cuisine" value={form.cuisine} onChangeText={(v) => update({ cuisine: v })} placeholder="Mexican, Italian, ..." autoCapitalize="words" />
        <TextField label="Tags" value={form.tagsText} onChangeText={(v) => update({ tagsText: v })} placeholder="quick, vegetarian, crockpot" autoCapitalize="none" hint="Separate with commas" />

        <Text style={type.heading}>Ingredients</Text>
        {form.ingredients.map((ing, idx) => (
          <View key={ing.key} style={styles.ingredientCard}>
            <View style={styles.ingredientRow}>
              <TextInput
                value={ing.quantityText}
                onChangeText={(v) => updateIngredient(idx, { quantityText: v })}
                placeholder="1 1/2"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.qty]}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                accessibilityLabel="Amount"
              />
              <TextInput
                value={ing.unit}
                onChangeText={(v) => updateIngredient(idx, { unit: v })}
                placeholder="cup"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.unit]}
                autoCapitalize="none"
                accessibilityLabel="Unit"
              />
              <TextInput
                value={ing.name}
                onChangeText={(v) => updateIngredient(idx, { name: v })}
                placeholder="ingredient"
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel="Ingredient"
              />
              <IconButton icon="close" label="Remove ingredient" color={colors.muted} onPress={() => removeIngredient(idx)} />
            </View>
            <TextInput
              value={ing.preparation}
              onChangeText={(v) => updateIngredient(idx, { preparation: v })}
              placeholder="prep, e.g. diced (optional)"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.prep]}
              accessibilityLabel="Preparation"
            />
          </View>
        ))}
        <Button title="Add ingredient" variant="secondary" onPress={() => update({ ingredients: [...form.ingredients, { key: nextKey(), quantityText: '', unit: '', name: '', preparation: '' }] })} />

        <Text style={type.heading}>Steps</Text>
        {form.steps.map((step, idx) => (
          <View key={step.key} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{idx + 1}</Text>
            <TextInput
              value={step.text}
              onChangeText={(v) => updateStep(idx, v)}
              placeholder="What to do"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.stepInput]}
              accessibilityLabel={`Step ${idx + 1}`}
            />
            <IconButton icon="close" label="Remove step" color={colors.muted} onPress={() => removeStep(idx)} />
          </View>
        ))}
        <Button title="Add step" variant="secondary" onPress={() => update({ steps: [...form.steps, { key: nextKey(), text: '' }] })} />

        <Button title={id ? 'Save changes' : 'Save recipe'} onPress={onSave} loading={busy} />
      </Screen>
    </>
  );

  function updateIngredient(idx: number, patch: Partial<IngredientForm>) {
    setForm((f) => {
      if (!f) return f;
      // A renamed ingredient is relabeled on save.
      const reset = 'name' in patch ? { canonical_name: null, store_section: null } : {};
      const ingredients = f.ingredients.map((i, j) => (j === idx ? { ...i, ...patch, ...reset } : i));
      return { ...f, ingredients };
    });
  }
  function removeIngredient(idx: number) {
    setForm((f) => (f ? { ...f, ingredients: f.ingredients.filter((_, j) => j !== idx) } : f));
  }
  function updateStep(idx: number, text: string) {
    setForm((f) => (f ? { ...f, steps: f.steps.map((s, j) => (j === idx ? { ...s, text } : s)) } : f));
  }
  function removeStep(idx: number) {
    setForm((f) => (f ? { ...f, steps: f.steps.filter((_, j) => j !== idx) } : f));
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  photoBox: { height: 180, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  photoActions: { flexDirection: 'row', gap: space.sm },
  rowFields: { flexDirection: 'row', gap: space.sm },
  smallField: { minWidth: 0 },
  input: {
    minHeight: tapTarget - 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.ink,
  },
  qty: { width: 72 },
  unit: { width: 76 },
  prep: { marginTop: space.xs },
  ingredientCard: { gap: 0 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  stepNumber: { width: 24, paddingTop: 12, fontSize: 16, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  stepInput: { flex: 1, minHeight: 64, textAlignVertical: 'top' },
});
