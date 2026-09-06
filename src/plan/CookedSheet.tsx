import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { usePantry, useUpsertPantryItems } from '@/pantry/hooks';
import { StatusControl } from '@/pantry/StatusControl';
import type { PantryStatus, PantryUpsert } from '@/pantry/types';
import { useRecipe } from '@/recipes/hooks';
import { describeError } from '@/lib/errors';
import { colors, fonts, space, type } from '@/theme/tokens';
import { useSetCooked } from './hooks';
import type { PlanEntry } from './types';

// Marking a recipe cooked is the moment to correct the pantry. Tracked items
// show their current status; untracked ones are left alone unless a status is
// chosen, which also starts tracking them.
export function CookedSheet({ entry, onClose, onDone }: { entry: PlanEntry | null; onClose: () => void; onDone: () => void }) {
  const recipe = useRecipe(entry?.recipe_id ?? undefined);
  const pantry = usePantry();
  const upsert = useUpsertPantryItems();
  const setCooked = useSetCooked();
  const [choices, setChoices] = useState<Record<string, PantryStatus | null>>({});
  const [error, setError] = useState<string | null>(null);

  const byCanonical = useMemo(() => new Map((pantry.data ?? []).map((p) => [p.canonical_name, p])), [pantry.data]);
  const ingredients = recipe.data?.recipe_ingredients ?? [];

  useEffect(() => {
    // Seed from the pantry each time the sheet opens for a new entry.
    const seed: Record<string, PantryStatus | null> = {};
    for (const ing of ingredients) seed[ing.canonical_name] = byCanonical.get(ing.canonical_name)?.status ?? null;
    setChoices(seed);
    setError(null);
  }, [entry?.id, recipe.data?.id, pantry.data]);

  if (!entry) return null;

  async function done() {
    if (!entry) return;
    setError(null);
    const updates: PantryUpsert[] = [];
    for (const ing of ingredients) {
      const chosen = choices[ing.canonical_name];
      const current = byCanonical.get(ing.canonical_name)?.status ?? null;
      if (chosen && chosen !== current) {
        updates.push({ canonical_name: ing.canonical_name, display_name: byCanonical.get(ing.canonical_name)?.display_name ?? ing.name, status: chosen, store_section: ing.store_section });
      }
    }
    try {
      await setCooked.mutateAsync({ id: entry.id, cooked: true, recipeId: entry.recipe_id });
      if (updates.length) await upsert.mutateAsync(updates);
      onDone();
    } catch (e) {
      setError(describeError(e));
    }
  }

  const busy = setCooked.isPending || upsert.isPending;

  return (
    <BottomSheet visible onClose={onClose} title="Mark cooked">
      <Text style={type.heading}>{entry.recipe?.title ?? 'Recipe'}</Text>
      <Text style={type.small}>Update the pantry so the next grocery list is right. Untracked items are left alone unless you pick a status.</Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <ScrollView style={{ maxHeight: 340 }}>
        {recipe.isPending ? <Text style={type.bodyMuted}>Loading ingredients…</Text> : null}
        {ingredients.map((ing) => {
          const tracked = byCanonical.has(ing.canonical_name);
          return (
            <View key={ing.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{byCanonical.get(ing.canonical_name)?.display_name ?? ing.name}</Text>
                {!tracked ? <Text style={type.small}>Not tracked</Text> : null}
              </View>
              <StatusControl value={choices[ing.canonical_name] ?? null} onChange={(s) => setChoices((c) => ({ ...c, [ing.canonical_name]: s }))} label={ing.name} />
            </View>
          );
        })}
      </ScrollView>
      <Button title="Done" loading={busy} onPress={done} />
      <Button title="Just mark cooked" variant="secondary" disabled={busy} onPress={() => setCooked.mutate({ id: entry.id, cooked: true, recipeId: entry.recipe_id }, { onSuccess: onDone, onError: (e) => setError(describeError(e)) })} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
});
