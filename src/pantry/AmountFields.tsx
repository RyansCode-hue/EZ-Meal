import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { UNIT_CHOICES, normalizeUnit } from '@/groceries/units';
import { space } from '@/theme/tokens';

type Props = {
  amount: string;
  unit: string;
  onAmountChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  error?: string | null;
};

// Amount and unit side by side, with the common units as one-tap chips. A
// chip is lit when the typed unit normalizes to it, so "lbs" lights "lb".
export function AmountFields({ amount, unit, onAmountChange, onUnitChange, error }: Props) {
  const current = normalizeUnit(unit);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label="Amount" value={amount} onChangeText={onAmountChange} placeholder="2 or 1/2" autoCorrect={false} error={error} accessibilityLabel="Amount" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Unit" value={unit} onChangeText={onUnitChange} placeholder="lb, oz, cup" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Unit" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
        {UNIT_CHOICES.map((u) => (
          <Chip key={u} label={u} active={current === u} onPress={() => onUnitChange(current === u ? '' : u)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  chips: { gap: space.xs, paddingVertical: 2 },
});
