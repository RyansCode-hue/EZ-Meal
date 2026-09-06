import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/auth/AuthProvider';
import { useHousehold } from '@/household/useHousehold';
import { addDays, formatDateRange, formatWeekRange, fromISODate, startOfWeek, toISODate, type ISODate } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { confirm } from '@/lib/confirm';
import { useAddManualItem, useClearChecked, useDeleteGroceryItem, useGenerateGroceries, useGroceries, useToggleGrocery } from '@/groceries/hooks';
import { displayName, SECTION_ORDER, type GroceryItem } from '@/groceries/types';
import { parseItemText } from '@/groceries/parseItem';
import { STORE_SECTION_LABELS, type StoreSection } from '@/recipes/types';
import { formatQuantity } from '@/recipes/quantity';
import { BottomSheet, SheetRow } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { fonts, colors, maxContentWidth, radius, space, tapTarget, type } from '@/theme/tokens';

type Section = { title: string; key: StoreSection; data: GroceryItem[] };

export default function GroceriesTab() {
  const { household } = useHousehold();
  const { session } = useAuth();
  const groceries = useGroceries();
  const generate = useGenerateGroceries();
  const toggle = useToggleGrocery();
  const addItem = useAddManualItem();
  const remove = useDeleteGroceryItem();
  const clear = useClearChecked();
  const [genOpen, setGenOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(describeError(e));

  const items = groceries.data ?? [];
  const sections = useMemo<Section[]>(() => {
    const by = new Map<StoreSection, GroceryItem[]>();
    for (const i of items) by.set(i.store_section, [...(by.get(i.store_section) ?? []), i]);
    return SECTION_ORDER.filter((k) => by.has(k)).map((k) => ({
      key: k,
      title: STORE_SECTION_LABELS[k],
      data: [...by.get(k)!].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
    }));
  }, [items]);
  const remaining = items.filter((i) => !i.checked).length;
  const bought = items.length - remaining;

  const weekStartDay = household?.week_start_day ?? 0;
  const thisWeekStart = startOfWeek(new Date(), weekStartDay);
  const ranges: Array<{ label: string; detail: string; start: ISODate; end: ISODate }> = [
    { label: 'This week', detail: formatWeekRange(thisWeekStart), start: toISODate(thisWeekStart), end: toISODate(addDays(thisWeekStart, 6)) },
    { label: 'Next week', detail: formatWeekRange(addDays(thisWeekStart, 7)), start: toISODate(addDays(thisWeekStart, 7)), end: toISODate(addDays(thisWeekStart, 13)) },
    { label: 'This week and next', detail: formatDateRange(thisWeekStart, addDays(thisWeekStart, 13)), start: toISODate(thisWeekStart), end: toISODate(addDays(thisWeekStart, 13)) },
  ];

  const rangeLabel = household?.grocery_start && household.grocery_end ? `For ${formatDateRange(fromISODate(household.grocery_start), fromISODate(household.grocery_end))}` : null;

  async function onClear() {
    const ok = await confirm('Clear bought items?', `${bought} checked item${bought === 1 ? '' : 's'} will be removed from the list.`, 'Clear');
    if (ok) clear.mutate(undefined, { onError: fail });
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.summary}>
        <Text style={type.heading}>{rangeLabel ?? 'No list yet'}</Text>
        <Text style={type.small}>
          {items.length === 0 ? "Generate one from the week's plan, or add items by hand." : `${remaining} to buy · ${bought} in the cart`}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Generate" variant={items.length ? 'secondary' : 'primary'} onPress={() => setGenOpen(true)} style={{ flex: 1 }} loading={generate.isPending} />
        <Button title="Add item" variant="secondary" onPress={() => setAddOpen(true)} style={{ flex: 1 }} />
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {groceries.isError ? <Notice kind="error">{`Could not load the list. ${describeError(groceries.error)}`}</Notice> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Row
            item={item}
            mine={item.checked_by === session?.user.id}
            onToggle={() => toggle.mutate({ id: item.id, checked: !item.checked, userId: session?.user.id ?? null }, { onError: fail })}
            onDelete={() => remove.mutate(item.id, { onError: fail })}
          />
        )}
        ListEmptyComponent={groceries.isPending ? null : <EmptyState icon="cart-outline" title="Nothing to buy" body="Plan some recipes, then tap Generate." />}
        ListFooterComponent={bought > 0 ? <Button title={`Clear ${bought} bought item${bought === 1 ? '' : 's'}`} variant="secondary" onPress={onClear} loading={clear.isPending} style={{ marginTop: space.lg }} /> : null}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshing={groceries.isRefetching}
        onRefresh={() => groceries.refetch()}
        keyboardShouldPersistTaps="handled"
      />

      <BottomSheet visible={genOpen} onClose={() => setGenOpen(false)} title="Generate the list for">
        {ranges.map((r) => (
          <SheetRow
            key={r.label}
            icon={<Ionicons name="calendar-outline" size={22} color={colors.accent} />}
            title={r.label}
            body={r.detail}
            onPress={() => {
              setGenOpen(false);
              generate.mutate({ start: r.start, end: r.end }, { onError: fail });
            }}
          />
        ))}
        <Text style={type.small}>Recipes already marked cooked are left out. Checked-off and hand-added items stay on the list.</Text>
      </BottomSheet>

      <AddItemSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        busy={addItem.isPending}
        onAdd={(text, section) => {
          const parsed = parseItemText(text);
          if (!parsed.name) return;
          addItem.mutate({ name: parsed.name, quantity: parsed.quantity, unit: parsed.unit, section }, { onSuccess: () => setAddOpen(false), onError: fail });
        }}
      />
    </View>
  );
}

function Row({ item, mine, onToggle, onDelete }: { item: GroceryItem; mine: boolean; onToggle: () => void; onDelete: () => void }) {
  const amount = [formatQuantity(item.quantity), item.unit].filter(Boolean).join(' ');
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }} onPress={onToggle} style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}>
        <Ionicons name={item.checked ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={item.checked ? colors.accent : colors.ruleStrong} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, item.checked && styles.checked]}>
            {displayName(item)}
            {amount ? <Text style={[styles.amount, item.checked && styles.checked]}>{`  ${amount}`}</Text> : null}
          </Text>
          {item.note || item.is_manual || (item.checked && !mine) ? (
            <Text style={type.small}>{[item.note, item.is_manual ? 'Added by hand' : null, item.checked && !mine ? 'Checked by your partner' : null].filter(Boolean).join(' · ')}</Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${displayName(item)}`} onPress={onDelete} hitSlop={6} style={styles.deleteBtn}>
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function AddItemSheet({ visible, onClose, onAdd, busy }: { visible: boolean; onClose: () => void; onAdd: (text: string, section: StoreSection) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const [section, setSection] = useState<StoreSection>('other');
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add an item">
      <TextField label="Item" value={text} onChangeText={setText} placeholder="2 lb apples" autoFocus hint="A leading amount and unit are picked up automatically" onSubmitEditing={() => onAdd(text, section)} returnKeyType="done" />
      <View style={styles.chips}>
        {SECTION_ORDER.map((s) => (
          <Chip key={s} label={STORE_SECTION_LABELS[s]} active={section === s} onPress={() => setSection(s)} />
        ))}
      </View>
      <Button
        title="Add"
        loading={busy}
        disabled={!text.trim()}
        onPress={() => {
          onAdd(text, section);
          setText('');
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.sm },
  summary: { gap: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  sectionTitle: { ...type.label, marginTop: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, marginBottom: space.xs },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: tapTarget + 4 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  amount: { fontFamily: fonts.bodyMedium, color: colors.muted },
  checked: { textDecorationLine: 'line-through', color: colors.muted },
  deleteBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
