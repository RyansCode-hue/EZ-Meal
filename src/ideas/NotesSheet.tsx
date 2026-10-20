import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useHousehold } from '@/household/useHousehold';
import { describeError } from '@/lib/errors';
import { colors, fonts, radius, space, type } from '@/theme/tokens';
import { MAX_NOTE_CHARS, useAddNote, useDeleteNote, useHouseholdNotes } from './notes';

// What the assistant remembers about the household. Both members see and edit
// the same list; every chat reads it.
export function NotesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { household } = useHousehold();
  const notes = useHouseholdNotes();
  const add = useAddNote();
  const del = useDeleteNote();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_NOTE_CHARS;

  function submit() {
    if (!household || !trimmed || tooLong) return;
    setError(null);
    add.mutate({ householdId: household.id, text: trimmed }, { onSuccess: () => setText(''), onError: (e) => setError(describeError(e)) });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="What the assistant remembers">
      <Text style={type.small}>It follows these in every chat. It adds to the list when you mention something lasting, like a dislike or an allergy.</Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {notes.isError ? <Notice kind="error">{`Could not load notes. ${describeError(notes.error)}`}</Notice> : null}
      <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
        {notes.data?.length === 0 ? <Text style={type.bodyMuted}>Nothing yet.</Text> : null}
        {(notes.data ?? []).map((n) => (
          <View key={n.id} style={styles.row}>
            <Text style={styles.text}>{n.text}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Forget: ${n.text}`}
              hitSlop={6}
              onPress={() => del.mutate(n.id, { onError: (e) => setError(describeError(e)) })}
              style={styles.remove}
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <TextField
        label="Add a note"
        value={text}
        onChangeText={setText}
        placeholder="We avoid pork"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={tooLong ? `Keep it under ${MAX_NOTE_CHARS} characters.` : null}
      />
      <Button title="Add" variant="secondary" loading={add.isPending} disabled={!trimmed || tooLong || !household} onPress={submit} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingLeft: space.md, marginBottom: space.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
