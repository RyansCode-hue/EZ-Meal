import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';

export type SegmentOption<T extends string> = { value: T; label: string; color?: string };

type Props<T extends string> = {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label?: string;
};

// A compact three-way switch. The selected option fills with its own color.
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.cell, on && { backgroundColor: o.color ?? colors.accent }, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 3, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.rule, borderRadius: radius.md },
  cell: { minHeight: 40, minWidth: 58, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2 },
  text: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.muted },
  textOn: { color: colors.accentInk },
});
