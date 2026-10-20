import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, active, onPress, onRemove, accessibilityLabel }: Props) {
  const content = (
    <Text style={[styles.text, active && styles.textActive]}>
      {label}
      {onRemove ? '  ×' : ''}
    </Text>
  );
  if (!onPress && !onRemove) return <Text style={[styles.base, styles.text]}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={onRemove ? `Remove ${label}` : (accessibilityLabel ?? label)}
      accessibilityState={{ selected: !!active }}
      onPress={onRemove ?? onPress}
      style={({ pressed }) => [styles.base, active && styles.active, pressed && { opacity: 0.8 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  textActive: { color: colors.accentInk },
});
