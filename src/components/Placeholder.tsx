import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '@/theme/tokens';

// Stand-in body for tabs whose feature lands in a later phase.
export function Placeholder({ title, phase, blurb }: { title: string; phase: number; blurb: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={type.title}>{title}</Text>
      <View style={styles.card}>
        <Text style={type.label}>Coming in phase {phase}</Text>
        <Text style={type.bodyMuted}>{blurb}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  card: {
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
  },
});
