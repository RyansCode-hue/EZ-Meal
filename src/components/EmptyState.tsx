import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, space, type } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.ruleStrong} />
      <Text style={type.heading}>{title}</Text>
      <Text style={[type.bodyMuted, { textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
});
