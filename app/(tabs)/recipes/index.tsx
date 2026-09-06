import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRecipes } from '@/recipes/hooks';
import { useSignedPhotoUrl } from '@/recipes/photos';
import { averageRating, totalMinutes, type RecipeSummary } from '@/recipes/types';
import { formatMinutes } from '@/recipes/quantity';
import { Chip } from '@/components/Chip';
import { Stars } from '@/components/Stars';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { BottomSheet, SheetRow } from '@/components/BottomSheet';
import { describeError } from '@/lib/errors';
import { fonts, colors, maxContentWidth, radius, space, tapTarget, type } from '@/theme/tokens';

const QUICK_MINUTES = 30;

export default function RecipesTab() {
  const router = useRouter();
  const recipes = useRecipes();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes.data ?? []) for (const t of r.tags) set.add(t);
    return [...set].sort();
  }, [recipes.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (recipes.data ?? []).filter((r) => {
      if (tag && !r.tags.includes(tag)) return false;
      if (quick) {
        const mins = totalMinutes(r);
        if (mins == null || mins > QUICK_MINUTES) return false;
      }
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || (r.cuisine ?? '').toLowerCase().includes(q) || r.tags.some((t) => t.includes(q));
    });
  }, [recipes.data, search, tag, quick]);

  const header = (
    <View style={styles.header}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search recipes"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {allTags.length > 0 || (recipes.data?.length ?? 0) > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={`Under ${QUICK_MINUTES} min`} active={quick} onPress={() => setQuick((v) => !v)} />
          {allTags.map((t) => (
            <Chip key={t} label={t} active={tag === t} onPress={() => setTag(tag === t ? null : t)} />
          ))}
        </ScrollView>
      ) : null}
      {recipes.isError ? <Notice kind="error">{`Could not load recipes. ${describeError(recipes.error)}`}</Notice> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Recipes',
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable accessibilityLabel="Household settings" hitSlop={8} style={{ minWidth: tapTarget, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={24} color={colors.ink} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecipeRow recipe={item} onPress={() => router.push(`/recipes/${item.id}`)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          recipes.isPending ? null : recipes.data?.length ? (
            <EmptyState icon="filter-outline" title="No matches" body="Try a different search or clear the filters." />
          ) : (
            <EmptyState icon="book-outline" title="No recipes yet" body="Tap the plus button to type one in or paste one from anywhere." />
          )
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshing={recipes.isRefetching}
        onRefresh={() => recipes.refetch()}
        keyboardShouldPersistTaps="handled"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add recipe"
        onPress={() => setAddOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={30} color={colors.accentInk} />
      </Pressable>
      <AddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={(kind) => {
          setAddOpen(false);
          router.push(kind === 'manual' ? '/recipes/edit' : kind === 'paste' ? '/recipes/import-text' : kind === 'photo' ? '/recipes/import-file' : '/recipes/import-url');
        }}
      />
    </View>
  );
}

function RecipeRow({ recipe, onPress }: { recipe: RecipeSummary; onPress: () => void }) {
  const photo = useSignedPhotoUrl(recipe.photo_path);
  const mins = totalMinutes(recipe);
  const avg = averageRating(recipe.recipe_ratings);
  const meta = [mins != null ? formatMinutes(mins) : null, recipe.cuisine].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <View style={styles.thumb}>
        {photo.data ? (
          <Image source={{ uri: photo.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="restaurant-outline" size={24} color={colors.ruleStrong} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        {meta ? <Text style={type.small}>{meta}</Text> : null}
        <View style={styles.rowFooter}>
          {avg != null ? <Stars value={avg} size={14} /> : null}
          {recipe.tags.length ? (
            <Text style={[type.small, { flexShrink: 1 }]} numberOfLines={1}>
              {recipe.tags.join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ruleStrong} />
    </Pressable>
  );
}

type AddKind = 'manual' | 'paste' | 'photo' | 'url';

function AddSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (kind: AddKind) => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add a recipe">
      <SheetRow icon={<Ionicons name="create-outline" size={24} color={colors.accent} />} title="Type it in" body="Ingredients and steps by hand" onPress={() => onPick('manual')} />
      <SheetRow icon={<Ionicons name="clipboard-outline" size={24} color={colors.accent} />} title="Paste text" body="From a message, note, or website" onPress={() => onPick('paste')} />
      <SheetRow icon={<Ionicons name="document-attach-outline" size={24} color={colors.accent} />} title="Photo or file" body="A photo, screenshot, PDF, Word, or text file" onPress={() => onPick('photo')} />
      <SheetRow icon={<Ionicons name="link-outline" size={24} color={colors.accent} />} title="Website link" body="Paste a URL and it is read for you" onPress={() => onPick('url')} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: space.lg, paddingBottom: 96, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: tapTarget,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  search: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  chips: { gap: space.sm, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 17, color: colors.ink },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
