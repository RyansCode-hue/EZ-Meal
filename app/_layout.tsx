import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { useHousehold } from '@/household/useHousehold';
import { CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/query';
import { colors } from '@/theme/tokens';
import { Notice } from '@/components/Notice';
import { describeError } from '@/lib/errors';
import { RealtimeSync } from '@/lib/RealtimeSync';
import { ReminderSync } from '@/notifications/ReminderSync';

// Shown by Expo Router when a screen throws. The details are logged; the person
// gets a plain explanation and a retry.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  console.error('Unhandled screen error', error);
  return (
    <View style={[styles.center, { padding: 24, gap: 12 }]}>
      <Notice kind="error">{`Something went wrong on this screen. ${error.message}`}</Notice>
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }} onPress={() => void retry()} accessibilityRole="button">
        Try again
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });
  if (fontError) console.error('Font loading failed; falling back to system fonts', fontError.message);
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE, buster: 'v1' }}
        onSuccess={() => {
          // Cache restored from disk: replay anything done offline, then refresh.
          queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
        }}
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

// Routes are gated by auth state and household membership:
//   no session            -> (auth)
//   session, no household -> household-setup
//   session + household   -> (tabs)
function Gate() {
  const { session, loading } = useAuth();
  const household = useHousehold();

  if (loading || (session && household.isPending)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (session && household.isError) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Notice kind="error">{`Could not load your household. ${describeError(household.error)}`}</Notice>
      </View>
    );
  }

  const signedIn = !!session;
  const hasHousehold = !!household.household;

  return (
    <>
      {signedIn && household.household ? <RealtimeSync householdId={household.household.id} /> : null}
      {signedIn && household.household ? <ReminderSync /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasHousehold}>
        <Stack.Screen name="household-setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: true, title: 'Household' }} />
      </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground },
});
