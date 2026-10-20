import { StyleSheet, Text, View } from 'react-native';
import { formatIngredient, formatMinutes } from '@/recipes/quantity';
import { colors, fonts, space, type } from '@/theme/tokens';

type Ingredient = { quantity: number | null; unit: string | null; name: string; preparation: string | null };

/** "Italian · 10 min prep · 25 min cook", skipping whatever is unknown. */
export function recipeMetaLine(r: { cuisine: string | null; prep_minutes: number | null; cook_minutes: number | null }): string {
  return [r.cuisine, r.prep_minutes != null ? `${formatMinutes(r.prep_minutes)} prep` : null, r.cook_minutes != null ? `${formatMinutes(r.cook_minutes)} cook` : null]
    .filter(Boolean)
    .join(' · ');
}

// Shared by the saved recipe page and the preview of an assistant idea.
export function IngredientList({ ingredients, factor = 1 }: { ingredients: Ingredient[]; factor?: number }) {
  return (
    <View style={styles.section}>
      <Text style={type.heading}>Ingredients</Text>
      {ingredients.length === 0 ? <Text style={type.bodyMuted}>None listed.</Text> : null}
      {ingredients.map((ing, i) => {
        const f = formatIngredient(ing, factor);
        return (
          <View key={i} style={styles.ingredient}>
            <Text style={styles.amount}>{f.amount}</Text>
            <Text style={styles.ingredientName}>
              {f.name}
              {f.preparation ? <Text style={type.small}>{`, ${f.preparation}`}</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function StepList({ steps }: { steps: Array<{ text: string }> }) {
  return (
    <View style={styles.section}>
      <Text style={type.heading}>Steps</Text>
      {steps.length === 0 ? <Text style={type.bodyMuted}>None listed.</Text> : null}
      {steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNumber}>{i + 1}</Text>
          <Text style={[type.body, { flex: 1 }]}>{step.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  ingredient: { flexDirection: 'row', gap: space.md, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  amount: { width: 84, fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.accent, fontVariant: ['tabular-nums'] },
  ingredientName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, lineHeight: 22 },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: 6 },
  stepNumber: { width: 28, fontFamily: fonts.heading, fontSize: 18, color: colors.accent, fontVariant: ['tabular-nums'] },
});
