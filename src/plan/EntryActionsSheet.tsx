import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet, SheetRow } from '@/components/BottomSheet';
import { Stepper } from '@/components/Stepper';
import { Notice } from '@/components/Notice';
import { formatDayLong, type ISODate } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { colors, type } from '@/theme/tokens';
import { DayPickerSheet } from './DayPickerSheet';
import { CookedSheet } from './CookedSheet';
import { useMovePlanEntry, useRemovePlanEntry, useRenamePlanEntry, useReorderPlanDay, useSetCooked, useSetEntryServings } from './hooks';
import { NameMealSheet } from './NameMealSheet';
import { entryTitle, type PlanEntry } from './types';

type Props = {
  entry: PlanEntry | null;
  dayEntries: PlanEntry[];
  weekDays: ISODate[];
  onClose: () => void;
};

export function EntryActionsSheet({ entry, dayEntries, weekDays, onClose }: Props) {
  const setCooked = useSetCooked();
  const reorder = useReorderPlanDay();
  const move = useMovePlanEntry();
  const remove = useRemovePlanEntry();
  const setServings = useSetEntryServings();
  const rename = useRenamePlanEntry();
  const [renaming, setRenaming] = useState(false);
  const [pickingDay, setPickingDay] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entry) return null;
  const index = dayEntries.findIndex((e) => e.id === entry.id);
  const cooked = !!entry.cooked_at;
  const fail = (e: unknown) => setError(describeError(e));

  function shift(delta: number) {
    if (!entry) return;
    const ids = dayEntries.map((e) => e.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorder.mutate({ date: entry.date, ids }, { onSuccess: onClose, onError: fail });
  }

  return (
    <>
      <BottomSheet visible={!!entry && !pickingDay && !cooking && !renaming} onClose={onClose}>
        <Text style={type.heading}>{entryTitle(entry)}</Text>
        <Text style={type.small}>{formatDayLong(entry.date)}</Text>
        {error ? <Notice kind="error">{error}</Notice> : null}
        {entry.kind === 'recipe' ? (
          <View style={styles.servings}>
            <Stepper
              label="Servings"
              value={entry.servings ?? entry.recipe?.servings ?? 1}
              min={1}
              onChange={(v) => setServings.mutate({ id: entry.id, servings: v }, { onError: fail })}
            />
          </View>
        ) : null}
        <SheetRow
          icon={<Ionicons name={cooked ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={22} color={colors.accent} />}
          title={cooked ? 'Mark not cooked' : 'Mark cooked'}
          body={entry.kind === 'recipe' ? 'Updates when this recipe was last made' : undefined}
          onPress={() => {
            // Cooking a recipe opens the pantry check; anything else just toggles.
            if (!cooked && entry.kind === 'recipe' && entry.recipe_id) setCooking(true);
            else setCooked.mutate({ id: entry.id, cooked: !cooked, recipeId: entry.recipe_id }, { onSuccess: onClose, onError: fail });
          }}
        />
        {entry.kind === 'meal' || entry.kind === 'eating_out' ? (
          <SheetRow icon={<Ionicons name="create-outline" size={22} color={colors.ink} />} title="Rename" onPress={() => setRenaming(true)} />
        ) : null}
        <SheetRow icon={<Ionicons name="arrow-up" size={22} color={colors.ink} />} title="Move up" disabled={index <= 0} onPress={() => shift(-1)} />
        <SheetRow icon={<Ionicons name="arrow-down" size={22} color={colors.ink} />} title="Move down" disabled={index < 0 || index >= dayEntries.length - 1} onPress={() => shift(1)} />
        <SheetRow icon={<Ionicons name="calendar-outline" size={22} color={colors.ink} />} title="Move to another day" onPress={() => setPickingDay(true)} />
        <SheetRow
          icon={<Ionicons name="trash-outline" size={22} color={colors.danger} />}
          title="Remove from plan"
          destructive
          onPress={() => remove.mutate(entry.id, { onSuccess: onClose, onError: fail })}
        />
      </BottomSheet>
      {renaming ? (
        <NameMealSheet
          visible
          title="Rename"
          initial={entry.label ?? entryTitle(entry)}
          action="Save"
          busy={rename.isPending}
          onClose={() => setRenaming(false)}
          onSubmit={(label) =>
            rename.mutate(
              { id: entry.id, label },
              {
                onSuccess: () => {
                  setRenaming(false);
                  onClose();
                },
                onError: (e) => {
                  setRenaming(false);
                  fail(e);
                },
              },
            )
          }
        />
      ) : null}
      {cooking ? <CookedSheet entry={entry} onClose={() => setCooking(false)} onDone={() => { setCooking(false); onClose(); }} /> : null}
      <DayPickerSheet
        visible={pickingDay}
        title="Move to"
        days={weekDays}
        exclude={entry.date}
        onClose={() => setPickingDay(false)}
        onPick={(date) => {
          setPickingDay(false);
          move.mutate({ id: entry.id, date }, { onSuccess: onClose, onError: fail });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  servings: { paddingVertical: 4 },
});
