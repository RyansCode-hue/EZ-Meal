import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, tapTarget } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
};

export function IconButton({ icon, label, onPress, color = colors.ink, size = 24 }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { minWidth: tapTarget, minHeight: tapTarget - 8, alignItems: 'center', justifyContent: 'center' },
});
