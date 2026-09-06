import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';

type Props = { kind: 'error' | 'info' | 'warn'; children: string };

export function Notice({ kind, children }: Props) {
  return (
    <View style={[styles.base, styles[kind]]} accessibilityRole="alert">
      <Text style={[styles.text, kind === 'error' && { color: colors.danger }, kind === 'warn' && { color: colors.warn }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { padding: space.md, borderRadius: radius.md },
  error: { backgroundColor: colors.dangerSoft },
  info: { backgroundColor: colors.accentSoft },
  warn: { backgroundColor: colors.warnSoft },
  text: { fontSize: 15, lineHeight: 20, color: colors.ink },
});
