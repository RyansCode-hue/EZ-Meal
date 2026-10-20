import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Notice } from '@/components/Notice';
import { describeError } from '@/lib/errors';
import { getPreview, holdPreview, usePreviewStore } from '@/recipes/draftStore';
import { totalMinutes } from '@/recipes/types';
import { formatMinutes } from '@/recipes/quantity';
import { colors, fonts, radius, space, tapTarget, type } from '@/theme/tokens';
import { BUILD_AROUND, MAX_INPUT, QUICK_ASKS, buildAroundPrompt, toApiHistory, type ChatEntry } from './chat';
import { useSuggestMeals } from './hooks';
import { useDeleteNote, useHouseholdNotes } from './notes';
import { NotesSheet } from './NotesSheet';

type BookRecipe = { id: string; title: string; servings: number | null };

let nextId = 0;
const newId = () => `m${(nextId += 1)}`;

// The meal chat. The conversation lives in memory for this session; what the
// assistant learns about the household is saved as notes and outlives it.
export function ChatCard({ byId, onPlan }: { byId: Map<string, BookRecipe>; onPlan: (r: BookRecipe) => void }) {
  const router = useRouter();
  const suggest = useSuggestMeals();
  const notes = useHouseholdNotes();
  const forget = useDeleteNote();
  usePreviewStore();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || suggest.isPending) return;
    setError(null);
    const userEntry: ChatEntry = { id: newId(), role: 'user', text: q.slice(0, MAX_INPUT) };
    const next = [...entries, userEntry];
    setEntries(next);
    setInput('');
    try {
      const result = await suggest.mutateAsync(toApiHistory(next));
      const reply: ChatEntry = {
        id: newId(),
        role: 'assistant',
        reply: result.reply,
        existing: result.existing.flatMap((x) => {
          const r = byId.get(x.recipe_id);
          return r ? [{ recipe_id: r.id, title: r.title, why: x.why }] : [];
        }),
        newRecipes: result.new_recipes.map((draft) => ({ key: holdPreview(draft), draft })),
        remembered: result.remembered,
        rememberError: result.remember_error,
      };
      setEntries([...next, reply]);
    } catch (e) {
      // The unanswered message goes back into the box so it can be sent again.
      setEntries(entries);
      setInput(q);
      setError(describeError(e));
    }
  }

  function startBuildAroundOther() {
    setInput('Build me a new recipe around ');
    inputRef.current?.focus();
  }

  const noteCount = notes.data?.length ?? 0;

  return (
    <View style={styles.wrap}>
      {entries.length === 0 ? (
        <View style={styles.starters}>
          <Text style={type.label}>Build a recipe around</Text>
          <View style={styles.chips}>
            {BUILD_AROUND.map((p) => (
              <Chip key={p} label={p} onPress={() => send(buildAroundPrompt(p))} />
            ))}
            <Chip label="Something else…" onPress={startBuildAroundOther} />
          </View>
          <Text style={[type.label, { marginTop: space.sm }]}>Or ask for</Text>
          <View style={styles.chips}>
            {QUICK_ASKS.map((q) => (
              <Chip key={q} label={q} onPress={() => send(q)} />
            ))}
          </View>
        </View>
      ) : null}

      {entries.map((e) =>
        e.role === 'user' ? (
          <View key={e.id} style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.userText}>{e.text}</Text>
          </View>
        ) : (
          <View key={e.id} style={[styles.bubble, styles.botBubble]}>
            <Text style={type.body}>{e.reply}</Text>
            {e.existing.map((x) => {
              const r = byId.get(x.recipe_id);
              return (
                <View key={x.recipe_id} style={styles.card}>
                  <Text style={styles.cardTitle}>{x.title}</Text>
                  <Text style={type.small}>{x.why}</Text>
                  <View style={styles.actions}>
                    <Button title="Open" variant="secondary" onPress={() => router.push(`/recipes/${x.recipe_id}`)} style={{ flex: 1 }} />
                    {r ? <Button title="Add to plan" variant="secondary" onPress={() => onPlan(r)} style={{ flex: 1 }} /> : null}
                  </View>
                </View>
              );
            })}
            {e.newRecipes.map(({ key, draft }) => {
              const savedId = getPreview(key)?.savedId ?? null;
              const mins = totalMinutes(draft);
              const meta = [draft.servings ? `${draft.servings} servings` : null, mins != null ? formatMinutes(mins) : null].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${draft.title}`}
                  onPress={() => router.push(savedId ? `/recipes/${savedId}` : { pathname: '/recipes/preview', params: { key } })}
                  style={({ pressed }) => [styles.card, styles.ideaRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardTitle}>{draft.title}</Text>
                    {draft.description || meta ? <Text style={type.small}>{[draft.description, meta].filter(Boolean).join(' ')}</Text> : null}
                    <Text style={[type.small, { color: colors.accent }]}>{savedId ? 'Saved to your recipes' : 'New idea · tap to see the full recipe'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
            {e.remembered.map((n) => (
              <View key={n.id} style={styles.remembered}>
                <Ionicons name="bookmark-outline" size={16} color={colors.accent} />
                <Text style={[type.small, { flex: 1 }]}>{`Remembered: ${n.text}`}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Forget: ${n.text}`} hitSlop={6} onPress={() => forget.mutate(n.id, { onError: (err) => setError(describeError(err)) })}>
                  <Text style={styles.link}>Forget</Text>
                </Pressable>
              </View>
            ))}
            {e.rememberError ? <Notice kind="warn">{e.rememberError}</Notice> : null}
          </View>
        ),
      )}

      {suggest.isPending ? (
        <View style={[styles.bubble, styles.botBubble, styles.thinking]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={type.small}>Thinking…</Text>
        </View>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}

      <View style={styles.askRow}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder={entries.length ? 'Reply, or ask to change something' : 'What are you in the mood for?'}
          placeholderTextColor={colors.muted}
          style={styles.askInput}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          editable={!suggest.isPending}
          maxLength={MAX_INPUT}
          multiline
          blurOnSubmit
          accessibilityLabel="Message the meal assistant"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={() => send(input)}
          disabled={suggest.isPending || !input.trim()}
          style={({ pressed }) => [styles.sendBtn, (suggest.isPending || !input.trim()) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="arrow-up" size={22} color={colors.accentInk} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => setNotesOpen(true)} hitSlop={6}>
          <Text style={styles.link}>{`What I remember${noteCount ? ` (${noteCount})` : ''}`}</Text>
        </Pressable>
        {entries.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEntries([]);
              setError(null);
            }}
            hitSlop={6}
          >
            <Text style={styles.link}>New chat</Text>
          </Pressable>
        ) : null}
      </View>

      <NotesSheet visible={notesOpen} onClose={() => setNotesOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  starters: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  bubble: { borderRadius: radius.lg, padding: space.md, gap: space.sm, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  userText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.accentInk },
  botBubble: { alignSelf: 'flex-start', backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.rule, width: '92%' },
  thinking: { flexDirection: 'row', alignItems: 'center', width: undefined },
  card: { gap: 4, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule },
  cardTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: tapTarget },
  remembered: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  askRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  askInput: { flex: 1, minHeight: tapTarget, maxHeight: 140, paddingHorizontal: space.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.ruleStrong, borderRadius: radius.md, backgroundColor: colors.surface, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  sendBtn: { width: tapTarget, height: tapTarget, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.accent, paddingVertical: 6 },
});
