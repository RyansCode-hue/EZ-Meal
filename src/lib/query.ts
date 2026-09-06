import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { TOGGLE_MUTATION_KEY, toggleGroceryFn } from '@/groceries/toggle';
import { PANTRY_UPSERT_KEY, upsertPantryFn } from '@/pantry/statusMutation';

// On native, "window focus" is the app coming to the foreground and "online" comes
// from the device's network state. The browser build uses the library defaults.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(!!state.isConnected)));
}

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Kept at least as long as the persisted cache so offline reads stay available.
      gcTime: CACHE_MAX_AGE,
    },
    mutations: {
      // Ordinary writes attempt immediately and fail with a clear offline message
      // rather than waiting silently for a connection. The few that opt into
      // 'offlineFirst' (grocery check-offs, pantry status) queue instead.
      networkMode: 'always',
    },
  },
});

// Lets a check-off made offline resume after the app was closed and reopened.
queryClient.setMutationDefaults(TOGGLE_MUTATION_KEY, { mutationFn: toggleGroceryFn });
queryClient.setMutationDefaults(PANTRY_UPSERT_KEY, { mutationFn: upsertPantryFn });

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ezmeal-query-cache',
  throttleTime: 1000,
});
