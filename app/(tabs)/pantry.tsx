import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeletePantryItem, useParsePantryImages, usePantry, useUpsertPantryItems, type ParsedPantryItem } from '@/pantry/hooks';
import { StatusControl } from '@/pantry/StatusControl';
import { AmountFields } from '@/pantry/AmountFields';
import { formatAmount, formatPantryAmount, readAmount, readSize, sizeApplies } from '@/pantry/amount';
import type { PantryItem, PantryStatus, PantryUpsert } from '@/pantry/types';
import { SECTION_ORDER } from '@/groceries/types';
import { parseItemText } from '@/groceries/parseItem';
import { useNormalizeIngredients } from '@/recipes/hooks';
import { cameraAvailable, photoToBase64Jpeg, pickPhotos } from '@/recipes/photos';
import { STORE_SECTION_LABELS, type StoreSection } from '@/recipes/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { describeError } from '@/lib/errors';
import { confirm } from '@/lib/confirm';
import { colors, fonts, maxContentWidth, radius, space, tapTarget, type } from '@/theme/tokens';

type Section = { title: string; data: PantryItem[] };
type Amount = { quantity: number | null; unit: string | null; package_quantity: number | null; package_unit: string | null };

export default function PantryTab() {
  const pantry = usePantry();
  const upsert = useUpsertPantryItems();
  const remove = useDeletePantryItem();
  const normalize = useNormalizeIngredients();
  const parseImages = useParsePantryImages();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [review, setReview] = useState<ParsedPantryItem[] | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (e: unknown) => setError(describeError(e));

  const items = pantry.data ?? [];
  const sections = useMemo<Section[]>(() => {
    const q = search.trim().toLowerCase();
    const by = new Map<StoreSection, PantryItem[]>();
    for (const i of items) {
      if (q && !i.display_name.toLowerCase().includes(q) && !i.canonical_name.includes(q)) continue;
      by.set(i.store_section, [...(by.get(i.store_section) ?? []), i]);
    }
    return SECTION_ORDER.filter((k) => by.has(k)).map((k) => ({ title: STORE_SECTION_LABELS[k], data: by.get(k)! }));
  }, [items, search]);

  function setStatus(item: PantryItem, status: PantryStatus) {
    upsert.mutate([{ canonical_name: item.canonical_name, status }], { onError: fail });
  }

  async function onDelete(item: PantryItem) {
    const ok = await confirm('Remove from pantry?', `${item.display_name} will no longer be tracked.`, 'Remove', true);
    if (ok) remove.mutate(item.id, { onError: fail });
  }

  // Hand-added items are labeled with a store section through the ingredient labeler.
  // An amount typed into the fields wins over one typed in front of the name.
  async function addByHand(text: string, status: PantryStatus, amount: Amount) {
    setError(null);
    setNotice(null);
    const parsed = parseItemText(text);
    if (!parsed.name) return;
    let canonical = parsed.name.toLowerCase();
    let section: StoreSection = 'other';
    try {
      const [label] = await normalize.mutateAsync([{ name: parsed.name, preparation: null }]);
      canonical = label.canonical_name;
      section = label.store_section;
    } catch (e) {
      setNotice(`Added under "Other" because sorting failed: ${describeError(e)}`);
    }
    const quantity = amount.quantity ?? parsed.quantity;
    const unit = amount.unit ?? parsed.unit;
    upsert.mutate([{ canonical_name: canonical, display_name: parsed.name, status, quantity, unit, package_quantity: amount.package_quantity, package_unit: amount.package_unit, store_section: section }], {
      onSuccess: () => setAddOpen(false),
      onError: fail,
    });
  }

  function saveEdit(patch: PantryUpsert) {
    setError(null);
    upsert.mutate([patch], { onSuccess: () => setEditing(null), onError: fail });
  }

  async function fromPhoto(source: 'camera' | 'library') {
    setError(null);
    try {
      const photos = await pickPhotos(source, 3);
      if (!photos.length) return;
      setReading(true);
      const images = await Promise.all(photos.map(async (p) => ({ media_type: 'image/jpeg' as const, data: await photoToBase64Jpeg(p) })));
      const found = await parseImages.mutateAsync(images);
      setReview(found);
    } catch (e) {
      fail(e);
    } finally {
      setReading(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search the pantry" placeholderTextColor={colors.muted} style={styles.search} autoCorrect={false} accessibilityLabel="Search the pantry" />
      </View>
      <View style={styles.actions}>
        <Button title="Add item" variant="secondary" onPress={() => setAddOpen(true)} style={{ flex: 1 }} />
        <Button title={reading ? 'Reading…' : 'From a photo'} variant="secondary" loading={reading} onPress={() => (cameraAvailable ? askPhotoSource() : fromPhoto('library'))} style={{ flex: 1 }} />
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {notice ? <Notice kind="warn">{notice}</Notice> : null}
      {pantry.isError ? <Notice kind="error">{`Could not load the pantry. ${describeError(pantry.error)}`}</Notice> : null}
    </View>
  );

  async function askPhotoSource() {
    const camera = await confirm('Read from a photo', 'Take a photo of a receipt or a shelf, or choose one from your library?', 'Take photo');
    return fromPhoto(camera ? 'camera' : 'library');
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const amount = formatPantryAmount(item);
          return (
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.display_name}`}
                accessibilityHint="Change the amount, name, or status"
                onPress={() => setEditing(item)}
                style={({ pressed }) => [styles.rowBody, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={[type.small, !amount && styles.amountHint]}>{amount || 'Add amount'}</Text>
              </Pressable>
              <StatusControl value={item.status} onChange={(s) => setStatus(item, s)} label={item.display_name} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.display_name}`} onPress={() => onDelete(item)} hitSlop={6} style={styles.deleteBtn}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          pantry.isPending ? null : (
            <EmptyState icon="file-tray-stacked-outline" title={search ? 'No matches' : 'Nothing tracked yet'} body={search ? 'Try another word.' : 'Add staples by hand or read a receipt. Items marked Plenty stay off the grocery list.'} />
          )
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshing={pantry.isRefetching}
        onRefresh={() => pantry.refetch()}
        keyboardShouldPersistTaps="handled"
      />

      <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} busy={upsert.isPending || normalize.isPending} onAdd={addByHand} />

      {editing ? <EditSheet key={editing.id} item={editing} onClose={() => setEditing(null)} busy={upsert.isPending} onSave={saveEdit} /> : null}

      <ReviewSheet
        items={review}
        onClose={() => setReview(null)}
        busy={upsert.isPending}
        onAdd={(chosen) => {
          upsert.mutate(chosen.map(upsertFromParsed), { onSuccess: () => setReview(null), onError: fail });
        }}
      />
    </View>
  );
}

// A photo read that found no amount leaves any amount already on the item alone.
function upsertFromParsed(c: ParsedPantryItem): PantryUpsert {
  return {
    canonical_name: c.canonical_name,
    display_name: c.display_name,
    status: 'plenty',
    store_section: c.store_section,
    ...(c.quantity != null ? { quantity: c.quantity } : {}),
    ...(c.unit ? { unit: c.unit } : {}),
  };
}

// Form state for amount, unit, and the per-container size. The size is only
// read while it applies, so switching the unit to lb drops a stale size.
function useAmountForm(initial?: { quantity: number | null; unit: string | null; package_quantity: number | null; package_unit: string | null }) {
  const [amount, setAmount] = useState(initial?.quantity == null ? '' : formatAmount(initial.quantity, null));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [sizeAmount, setSizeAmount] = useState(initial?.package_quantity == null ? '' : formatAmount(initial.package_quantity, null));
  const [sizeUnit, setSizeUnit] = useState(initial?.package_unit ?? '');
  const read = readAmount(amount, unit);
  const applies = sizeApplies(amount, unit);
  const size = applies ? readSize(sizeAmount, sizeUnit) : ({ ok: true, quantity: null, unit: null } as const);
  const value: Amount | null = read.ok && size.ok ? { quantity: read.quantity, unit: read.unit, package_quantity: size.quantity, package_unit: size.unit } : null;
  const fields = (
    <AmountFields
      amount={amount}
      unit={unit}
      onAmountChange={setAmount}
      onUnitChange={setUnit}
      error={read.ok ? null : read.error}
      size={{ amount: sizeAmount, unit: sizeUnit, onAmountChange: setSizeAmount, onUnitChange: setSizeUnit, error: size.ok ? null : size.error }}
    />
  );
  const reset = () => {
    setAmount('');
    setUnit('');
    setSizeAmount('');
    setSizeUnit('');
  };
  return { value, fields, reset };
}

function AddSheet({ visible, onClose, onAdd, busy }: { visible: boolean; onClose: () => void; onAdd: (text: string, status: PantryStatus, amount: Amount) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<PantryStatus>('plenty');
  const form = useAmountForm();
  const canAdd = !!text.trim() && form.value != null;

  function submit() {
    if (!form.value || !text.trim()) return;
    onAdd(text, status, form.value);
    setText('');
    form.reset();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add to the pantry">
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Item" value={text} onChangeText={setText} placeholder="Rice" autoFocus hint="The store section is filled in for you." returnKeyType="done" onSubmitEditing={submit} />
        {form.fields}
        <StatusControl value={status} onChange={setStatus} label="Status" />
      </ScrollView>
      <Button title="Add" loading={busy} disabled={!canAdd} onPress={submit} />
    </BottomSheet>
  );
}

function EditSheet({ item, onClose, onSave, busy }: { item: PantryItem; onClose: () => void; onSave: (patch: PantryUpsert) => void; busy: boolean }) {
  const [name, setName] = useState(item.display_name);
  const [status, setStatus] = useState<PantryStatus>(item.status);
  const form = useAmountForm(item);

  function submit() {
    if (!form.value) return;
    // Every amount field is sent so a cleared field clears the stored value.
    onSave({ canonical_name: item.canonical_name, display_name: name.trim() || item.display_name, status, ...form.value });
  }

  return (
    <BottomSheet visible onClose={onClose} title="Edit item">
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Item" value={name} onChangeText={setName} returnKeyType="done" onSubmitEditing={submit} />
        {form.fields}
        <StatusControl value={status} onChange={setStatus} label="Status" />
      </ScrollView>
      <Button title="Save" loading={busy} disabled={!form.value} onPress={submit} />
    </BottomSheet>
  );
}

function ReviewSheet({ items, onClose, onAdd, busy }: { items: ParsedPantryItem[] | null; onClose: () => void; onAdd: (chosen: ParsedPantryItem[]) => void; busy: boolean }) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  if (!items) return null;
  const chosen = items.filter((i) => !excluded.has(i.canonical_name));
  return (
    <BottomSheet visible onClose={onClose} title={`Found ${items.length} item${items.length === 1 ? '' : 's'}`}>
      <Text style={type.small}>Untick anything that is wrong. Everything added starts as Plenty.</Text>
      <View style={{ maxHeight: 360 }}>
        <SectionList
          sections={[{ title: '', data: items }]}
          keyExtractor={(i) => i.canonical_name}
          renderItem={({ item }) => {
            const on = !excluded.has(item.canonical_name);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() =>
                  setExcluded((s) => {
                    const n = new Set(s);
                    if (n.has(item.canonical_name)) n.delete(item.canonical_name);
                    else n.add(item.canonical_name);
                    return n;
                  })
                }
                style={styles.reviewRow}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.accent : colors.ruleStrong} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.display_name}</Text>
                  <Text style={type.small}>{[formatAmount(item.quantity, item.unit), STORE_SECTION_LABELS[item.store_section]].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
      <Button title={`Add ${chosen.length} item${chosen.length === 1 ? '' : 's'}`} loading={busy} disabled={chosen.length === 0} onPress={() => onAdd(chosen)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: tapTarget, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule },
  search: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: space.sm },
  sectionTitle: { ...type.label, marginTop: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingLeft: space.md, paddingRight: 2, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, marginBottom: space.xs },
  rowBody: { flex: 1, minHeight: tapTarget, justifyContent: 'center' },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  amountHint: { color: colors.muted, opacity: 0.7 },
  deleteBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  formScroll: { flexShrink: 1 },
  form: { gap: space.md },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
});
