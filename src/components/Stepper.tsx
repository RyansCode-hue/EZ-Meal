import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, tapTarget } from '@/theme/tokens';

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  format?: (v: number) => string;
};

export function Stepper({ label, value, onChange, min = 1, step = 1, format }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={dec} disabled={value <= min} style={({ pressed }) => [styles.btn, pressed && styles.pressed, value <= min && styles.disabled]}>
          <Ionicons name="remove" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.value}>{format ? format(value) : String(value)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={inc} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <Ionicons name="add" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: tapTarget - 6,
    height: tapTarget - 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  value: { minWidth: 44, textAlign: 'center', fontFamily: fonts.heading, fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
});
