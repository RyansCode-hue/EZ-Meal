import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHousehold } from '@/household/useHousehold';
import { addDays, startOfWeek, toISODate } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { usePantryMatches } from '@/ideas/hooks';
import { ChatCard } from '@/ideas/ChatCard';
import { pickSurprise as pickSurpriseRecipe } from '@/ideas/rank';
import { useAddPlanEntry } from '@/plan/hooks';
import { DayPickerSheet } from '@/plan/DayPickerSheet';
import { useRecipes } from '@/recipes/hooks';
import { totalMinutes } from '@/recipes/types';
import { formatMinutes } from '@/recipes/quantity';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { colors, fonts, maxContentWidth, radius, space, tapTarget, type } from '@/theme/tokens';

const RECENT_DAYS = 14;

export default function IdeasTab() {
  const router = useRouter();
  const { household } = useHousehold();
  const recipes = useRecipes();
  const { matches, pantryCount } = usePantryMatches();
  const addToPlan = useAddPlanEntry();
  const [surprise, setSurprise] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ id: string; servings: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (e: unknown) => setError(describeError(e));

  const planDays = useMemo(() => {
    const start = startOfWeek(new Date(), household?.week_start_day ?? 0);
    return Array.from({ length: 14 }, (_, i) => toISODate(addDays(start, i)));
  }, [household?.week_start_day]);

  const byId = useMemo(() => new Map((recipes.data ?? []).map((r) => [r.id, r])), [recipes.data]);

  function pickSurprise() {
    const pick = pickSurpriseRecipe(recipes.data ?? [], surprise, RECENT_DAYS);
    if (!pick) return setNotice('Add a few recipes first.');
    setSurprise(pick.id);
  }

  const surpriseRecipe = surprise ? byId.get(surprise) : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Notice kind="error">{error}</Notice> : null}
        {notice ? <Notice kind="info">{notice}</Notice> : null}

        <Card icon="chatbubble-ellipses-outline" title="Meal chat" sub="Ask for ideas, build a recipe around an ingredient, or ask for changes">
          <ChatCard byId={byId} onPlan={(r) => setPlanning({ id: r.id, servings: r.servings })} />
        </Card>

        <Card icon="file-tray-stacked-outline" title="From the pantry" sub="What you can make with what is on hand">
          {pantryCount === 0 ? (
            <Text style={type.small}>Track a few pantry items and recipes will be ranked here by what you already have.</Text>
          ) : matches.length === 0 ? (
            <Text style={type.small}>No recipes with ingredients yet.</Text>
          ) : (
            matches.slice(0, 5).map((m) => (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`/recipes/${m.id}`)} style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{m.title}</Text>
                  <Text style={type.small}>{m.have === m.total ? 'You have everything' : `You have ${m.have} of ${m.total} · missing ${m.missing.slice(0, 3).join(', ')}${m.missing.length > 3 ? '…' : ''}`}</Text>
                </View>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round((100 * m.have) / m.total)}%` }]} />
                </View>
              </Pressable>
            ))
          )}
        </Card>

        <Card icon="shuffle-outline" title="Surprise me" sub={`A recipe you have not made in the last ${RECENT_DAYS} days`}>
          {surpriseRecipe ? (
            <View style={styles.suggestion}>
              <Text style={styles.rowTitle}>{surpriseRecipe.title}</Text>
              <Text style={type.small}>{[totalMinutes(surpriseRecipe) != null ? formatMinutes(totalMinutes(surpriseRecipe)) : null, surpriseRecipe.cuisine, surpriseRecipe.tags.join(' · ')].filter(Boolean).join(' · ')}</Text>
              <View style={styles.suggestionActions}>
                <Button title="Open" variant="secondary" onPress={() => router.push(`/recipes/${surpriseRecipe.id}`)} style={{ flex: 1 }} />
                <Button title="Add to plan" variant="secondary" onPress={() => setPlanning({ id: surpriseRecipe.id, servings: surpriseRecipe.servings })} style={{ flex: 1 }} />
              </View>
              <Button title="Another one" variant="secondary" onPress={pickSurprise} />
            </View>
          ) : (
            <Button title="Pick one" variant="secondary" onPress={pickSurprise} />
          )}
        </Card>
      </ScrollView>

      <DayPickerSheet
        visible={!!planning}
        title="Which day?"
        days={planDays}
        onClose={() => setPlanning(null)}
        onPick={(date) => {
          const p = planning;
          setPlanning(null);
          if (!p) return;
          addToPlan.mutate({ date, kind: 'recipe', recipeId: p.id, servings: p.servings }, { onSuccess: () => setNotice(`Added to the plan for ${date}.`), onError: fail });
        }}
      />
    </View>
  );
}

function Card({ icon, title, sub, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={type.small}>{sub}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.ink },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, minHeight: tapTarget },
  bar: { width: 48, height: 8, borderRadius: 4, backgroundColor: colors.rule, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  suggestion: { gap: space.xs, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  suggestionActions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
});
