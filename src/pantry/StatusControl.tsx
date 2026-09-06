import { Segmented } from '@/components/Segmented';
import { colors } from '@/theme/tokens';
import type { PantryStatus } from './types';

export const STATUS_OPTIONS = [
  { value: 'plenty' as const, label: 'Plenty', color: colors.accent },
  { value: 'low' as const, label: 'Low', color: colors.warn },
  { value: 'out' as const, label: 'Out', color: colors.muted },
];

export function StatusControl({ value, onChange, label }: { value: PantryStatus | null; onChange: (s: PantryStatus) => void; label?: string }) {
  return <Segmented value={value} options={STATUS_OPTIONS} onChange={onChange} label={label} />;
}
