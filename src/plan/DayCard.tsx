import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDay, type ISODate } from '@/lib/dates';
import { colors, fonts, radius, space, tapTarget, type } from '@/theme/tokens';
import { entryTitle, type PlanEntry } from './types';

type Props = {
  date: ISODate;
  entries: PlanEntry[];
  isToday: boolean;
  isPast: boolean;
  onAdd: () => void;
  onEntryPress: (entry: PlanEntry) => void;
  onEntryMenu: (entry: PlanEntry) => void;
};

const KIND_ICON = {
  recipe: 'restaurant-outline',
  meal: 'fast-food-outline',
  eating_out: 'storefront-outline',
  skip: 'remove-circle-outline',
} as const;

// Recipes and named meals are real dinners; eating out and skips are shown quieter.
function isMealKind(e: PlanEntry): boolean {
  return e.kind === 'recipe' || e.kind === 'meal';
}

export function DayCard({ date, entries, isToday, isPast, onAdd, onEntryPress, onEntryMenu }: Props) {
  const { weekday, date: dateLabel } = formatDay(date);
  return (
    <View style={[styles.card, isToday && styles.cardToday]}>
      <View style={styles.dateCol}>
        <Text style={[styles.weekday, isToday && { color: colors.accent }]}>{weekday}</Text>
        <Text style={[styles.dayNumber, isPast && { color: colors.muted }]}>{dateLabel.split(' ')[1]}</Text>
        {isToday ? <Text style={styles.todayPill}>Today</Text> : null}
      </View>
      <View style={styles.body}>
      {entries.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.empty, pressed && { opacity: 0.7 }]}>
          <Text style={type.small}>Nothing planned</Text>
        </Pressable>
      ) : (
        entries.map((e) => {
          const cooked = !!e.cooked_at;
          const sub = e.kind === 'recipe' && e.servings ? `${e.servings} servings` : null;
          return (
            <View key={e.id} style={styles.entry}>
              <Pressable accessibilityRole="button" onPress={() => onEntryPress(e)} style={({ pressed }) => [styles.entryMain, pressed && { opacity: 0.7 }]}>
                <Ionicons name={cooked ? 'checkmark-circle' : KIND_ICON[e.kind]} size={22} color={cooked ? colors.accent : isMealKind(e) ? colors.ink : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryTitle, !isMealKind(e) && { color: colors.muted }, cooked && styles.cooked]} numberOfLines={2}>
                    {entryTitle(e)}
                  </Text>
                  {sub ? <Text style={type.small}>{sub}</Text> : null}
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${entryTitle(e)}`} onPress={() => onEntryMenu(e)} hitSlop={6} style={styles.menuBtn}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
              </Pressable>
            </View>
          );
        })
      )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add to ${weekday}`} onPress={onAdd} hitSlop={6} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
        <Ionicons name="add" size={20} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardToday: { borderColor: colors.accent, borderWidth: 2 },
  dateCol: { width: 44, alignItems: 'center', paddingTop: 6, gap: 2 },
  weekday: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  dayNumber: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.ink },
  todayPill: { fontFamily: fonts.bodySemibold, fontSize: 10, color: colors.accent, backgroundColor: colors.accentSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden', letterSpacing: 0.5, textTransform: 'uppercase' },
  body: { flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: tapTarget - 4, justifyContent: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center' },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, minHeight: tapTarget - 4 },
  entryTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  cooked: { textDecorationLine: 'line-through', color: colors.muted },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
