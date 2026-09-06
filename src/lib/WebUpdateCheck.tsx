import { useEffect } from 'react';
import { Platform } from 'react-native';

// Web only. Phones keep a copy of the site's entry page for a while, so a fix
// can take a day to show up. This asks the server which build is current
// (never from cache) and reloads once when it differs from the running one.
const RUNNING = process.env.EXPO_PUBLIC_BUILD_ID;
const CHECK_EVERY_MS = 5 * 60 * 1000;

export function WebUpdateCheck() {
  useEffect(() => {
    if (Platform.OS !== 'web' || !RUNNING) return;
    let reloaded = false;
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== RUNNING && !reloaded) {
          reloaded = true;
          globalThis.location.reload();
        }
      } catch (e) {
        console.warn('version check failed', e);
      }
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
