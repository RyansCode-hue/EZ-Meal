import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHousehold } from '@/household/useHousehold';
import { addDays, formatWeekRange, startOfWeek, todayISO, weekDays, type ISODate } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { useAddPlanEntry, usePlanEntries } from '@/plan/hooks';
import { DayCard } from '@/plan/DayCard';
import { RecipePickerSheet } from '@/plan/RecipePickerSheet';
import { EntryActionsSheet } from '@/plan/EntryActionsSheet';
import { NameMealSheet } from '@/plan/NameMealSheet';
import type { PlanEntry } from '@/plan/types';
import { BottomSheet, SheetRow } from '@/components/BottomSheet';
import { Notice } from '@/components/Notice';
import { fonts, colors, maxContentWidth, radius, space, tapTarget, type } from '@/theme/tokens';

export default function PlanTab() {
  const router = useRouter();
  const { household, members } = useHousehold();
  const weekStartDay = household?.week_start_day ?? 0;
  const [weekOffset, setWeekOffset] = useState(0);
  const start = useMemo(() => addDays(startOfWeek(new Date(), weekStartDay), weekOffset * 7), [weekStartDay, weekOffset]);
  const days = useMemo(() => weekDays(start), [start]);
  const today = todayISO();
  const plan = usePlanEntries(days[0], days[6]);
  const add = useAddPlanEntry();
  const [addingTo, setAddingTo] = useState<ISODate | null>(null);
  const [pickingRecipeFor, setPickingRecipeFor] = useState<ISODate | null>(null);
  const [namingFor, setNamingFor] = useState<ISODate | null>(null);
  const [activeEntry, setActiveEntry] = useState<PlanEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<ISODate, PlanEntry[]>();
    for (const e of plan.data ?? []) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [plan.data]);

  const fail = (e: unknown) => setError(describeError(e));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {members.length < 2 ? <Notice kind="info">Share your invite code from the people icon so your partner sees this plan too.</Notice> : null}
        <View style={styles.weekNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => setWeekOffset((o) => o - 1)} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekLabel}>{formatWeekRange(start)}</Text>
            {weekOffset !== 0 ? (
              <Pressable accessibilityRole="button" onPress={() => setWeekOffset(0)} hitSlop={6}>
                <Text style={styles.todayLink}>Back to this week</Text>
              </Pressable>
            ) : (
              <Text style={type.small}>This week</Text>
            )}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={() => setWeekOffset((o) => o + 1)} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={24} color={colors.ink} />
          </Pressable>
        </View>
        {error ? <Notice kind="error">{error}</Notice> : null}
        {plan.isError ? <Notice kind="error">{`Could not load the plan. ${describeError(plan.error)}`}</Notice> : null}
        {days.map((day) => (
          <DayCard
            key={day}
            date={day}
            entries={byDay.get(day) ?? []}
            isToday={day === today}
            isPast={day < today}
            onAdd={() => setAddingTo(day)}
            onEntryPress={(e) => (e.kind === 'recipe' && e.recipe ? router.push(`/recipes/${e.recipe.id}`) : setActiveEntry(e))}
            onEntryMenu={setActiveEntry}
          />
        ))}
      </ScrollView>

      <BottomSheet visible={!!addingTo && !pickingRecipeFor && !namingFor} onClose={() => setAddingTo(null)} title="Add to the plan">
        <SheetRow
          icon={<Ionicons name="restaurant-outline" size={22} color={colors.accent} />}
          title="A recipe"
          body="Pick from your recipe book"
          onPress={() => {
            setPickingRecipeFor(addingTo);
          }}
        />
        <SheetRow
          icon={<Ionicons name="fast-food-outline" size={22} color={colors.accent} />}
          title="Just a meal name"
          body="Like Tacos or Leftovers, no recipe needed"
          onPress={() => setNamingFor(addingTo)}
        />
        <SheetRow
          icon={<Ionicons name="storefront-outline" size={22} color={colors.ink} />}
          title="Eating out"
          onPress={() => {
            if (addingTo) add.mutate({ date: addingTo, kind: 'eating_out' }, { onError: fail });
            setAddingTo(null);
          }}
        />
        <SheetRow
          icon={<Ionicons name="remove-circle-outline" size={22} color={colors.ink} />}
          title="Skip"
          body="No cooking that day"
          onPress={() => {
            if (addingTo) add.mutate({ date: addingTo, kind: 'skip' }, { onError: fail });
            setAddingTo(null);
          }}
        />
      </BottomSheet>

      <RecipePickerSheet
        visible={!!pickingRecipeFor}
        onClose={() => {
          setPickingRecipeFor(null);
          setAddingTo(null);
        }}
        onPick={(recipe) => {
          if (pickingRecipeFor) add.mutate({ date: pickingRecipeFor, kind: 'recipe', recipeId: recipe.id, servings: recipe.servings }, { onError: fail });
          setPickingRecipeFor(null);
          setAddingTo(null);
        }}
      />

      <NameMealSheet
        visible={!!namingFor}
        title="Add a meal"
        action="Add to plan"
        busy={add.isPending}
        onClose={() => {
          setNamingFor(null);
          setAddingTo(null);
        }}
        onSubmit={(label) => {
          if (namingFor) add.mutate({ date: namingFor, kind: 'meal', label }, { onError: fail });
          setNamingFor(null);
          setAddingTo(null);
        }}
      />

      <EntryActionsSheet entry={activeEntry} dayEntries={activeEntry ? (byDay.get(activeEntry.date) ?? []) : []} weekDays={days} onClose={() => setActiveEntry(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navBtn: { width: tapTarget, height: tapTarget, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule },
  weekLabel: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.3, color: colors.ink, fontVariant: ['tabular-nums'] },
  todayLink: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accent },
});
