import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { SIZE_UNIT_CHOICES, UNIT_CHOICES, normalizeUnit } from '@/groceries/units';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { sizeApplies } from './amount';

export type SizeFieldProps = {
  amount: string;
  unit: string;
  onAmountChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  error?: string | null;
};

type Props = {
  amount: string;
  unit: string;
  onAmountChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  error?: string | null;
  /** When given, counted items (box, can, bottle, or no unit) also ask how much each one holds. */
  size?: SizeFieldProps;
};

// Amount and unit side by side, with the common units as one-tap chips. A
// chip is lit when the typed unit normalizes to it, so "lbs" lights "lb".
export function AmountFields({ amount, unit, onAmountChange, onUnitChange, error, size }: Props) {
  const current = normalizeUnit(unit);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label="Amount" value={amount} onChangeText={onAmountChange} placeholder="2 or 1/2" autoCorrect={false} error={error} accessibilityLabel="Amount" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Unit" value={unit} onChangeText={onUnitChange} placeholder="lb, box, can" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Unit" />
        </View>
      </View>
      <UnitChips choices={UNIT_CHOICES} value={unit} onChange={onUnitChange} />
      {size && sizeApplies(amount, unit) ? (
        <View style={styles.sizeBox}>
          <Text style={styles.sizeTitle}>{`Each ${current ?? 'one'} holds`}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Size" value={size.amount} onChangeText={size.onAmountChange} placeholder="16" autoCorrect={false} error={size.error} accessibilityLabel="Size of each" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Size unit" value={size.unit} onChangeText={size.onUnitChange} placeholder="oz, lb, cup" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Size unit" />
            </View>
          </View>
          <UnitChips choices={SIZE_UNIT_CHOICES} value={size.unit} onChange={size.onUnitChange} labelPrefix="Each in " />
          <Text style={styles.hint}>Optional. Lets cooking take part of a container, like 8 oz from a 16 oz box.</Text>
        </View>
      ) : null}
    </View>
  );
}

function UnitChips({ choices, value, onChange, labelPrefix }: { choices: readonly string[]; value: string; onChange: (v: string) => void; labelPrefix?: string }) {
  const current = normalizeUnit(value);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
      {choices.map((u) => (
        <Chip key={u} label={u} accessibilityLabel={labelPrefix ? `${labelPrefix}${u}` : undefined} active={current === u} onPress={() => onChange(current === u ? '' : u)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  chips: { gap: space.xs, paddingVertical: 2 },
  sizeBox: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.surface },
  sizeTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  hint: { fontSize: 13, color: colors.muted },
});
