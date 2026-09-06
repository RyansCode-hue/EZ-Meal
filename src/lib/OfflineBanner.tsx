import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts, colors, space } from '@/theme/tokens';

export function OfflineBanner() {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warn} />
      <Text style={styles.text}>Offline. Changes will sync when you're back.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: 6, backgroundColor: colors.warnSoft },
  text: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.warn },
});
