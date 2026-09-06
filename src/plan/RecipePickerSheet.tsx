import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { useRecipes } from '@/recipes/hooks';
import { totalMinutes, type RecipeSummary } from '@/recipes/types';
import { formatMinutes } from '@/recipes/quantity';
import { fonts, colors, radius, space, tapTarget, type } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onPick: (recipe: RecipeSummary) => void;
  onClose: () => void;
};

export function RecipePickerSheet({ visible, onPick, onClose }: Props) {
  const recipes = useRecipes();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = recipes.data ?? [];
    return q ? all.filter((r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q))) : all;
  }, [recipes.data, search]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pick a recipe">
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCorrect={false}
          accessibilityLabel="Search recipes"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        style={{ maxHeight: 380 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: space.xs }} />}
        ListEmptyComponent={
          recipes.isPending ? null : <EmptyState icon="book-outline" title={search ? 'No matches' : 'No recipes yet'} body={search ? 'Try another word.' : 'Add recipes from the Recipes tab first.'} />
        }
        renderItem={({ item }) => {
          const mins = totalMinutes(item);
          return (
            <Pressable accessibilityRole="button" onPress={() => onPick(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.accentSoft }]}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={type.small}>{[mins != null ? formatMinutes(mins) : null, item.servings ? `${item.servings} servings` : null].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  search: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  row: { padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, gap: 2 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
});
