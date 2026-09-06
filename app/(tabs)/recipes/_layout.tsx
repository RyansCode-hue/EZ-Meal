import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme/tokens';

// The Recipes tab is a stack: list -> detail -> edit. Living inside the tab keeps
// the tab bar visible on every recipe screen, so there is always a way out.
export default function RecipesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ground },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.ground },
      }}
    />
  );
}
