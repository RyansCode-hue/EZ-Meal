import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, maxContentWidth, space } from '@/theme/tokens';

type Props = PropsWithChildren<{
  /** Scrollable content with keyboard avoidance, for forms. */
  scroll?: boolean;
  /** Set when a navigation header is shown, so the top inset is not applied twice. */
  header?: boolean;
  style?: ViewStyle;
}>;

export function Screen({ children, scroll, header, style }: Props) {
  const edges = header ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={edges}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, styles.flex, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
});
