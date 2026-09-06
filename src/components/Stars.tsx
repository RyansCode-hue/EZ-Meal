import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, tapTarget } from '@/theme/tokens';

type Props = {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: number;
};

// Read-only when onChange is absent. Tapping the current value clears it.
export function Stars({ value, onChange, size = 18 }: Props) {
  const rounded = value == null ? 0 : Math.round(value);
  return (
    <View style={styles.row} accessibilityRole={onChange ? 'adjustable' : 'text'} accessibilityLabel={`${rounded} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded;
        const icon = <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? colors.warn : colors.ruleStrong} />;
        if (!onChange) return <View key={n}>{icon}</View>;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
            onPress={() => onChange(n === rounded ? null : n)}
            hitSlop={4}
            style={styles.tap}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tap: { minWidth: tapTarget / 1.5, minHeight: tapTarget / 1.5, alignItems: 'center', justifyContent: 'center' },
});
