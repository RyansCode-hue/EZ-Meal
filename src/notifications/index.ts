import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { fromISODate, toISODate, addDays } from '@/lib/dates';
import type { PlanEntry } from '@/plan/types';
import { entryTitle } from '@/plan/types';

// Reminders live on the phone. The website cannot schedule them (no reliable
// background delivery in mobile browsers), so every entry point returns early there.
export const remindersAvailable = Platform.OS !== 'web';

const CHANNEL = 'household';
const PLANNING_ID = 'planning-reminder';
const DINNER_PREFIX = 'dinner-';

export function configureNotifications() {
  if (!remindersAvailable) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Household', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' }).catch((e) => console.error('notification channel', e));
  }
}

/** Asks once; returns whether notifications may be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersAvailable) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Registers this device for partner pushes and stores the token on the member row. */
export async function registerPushToken(userId: string): Promise<void> {
  if (!remindersAvailable || !Device.isDevice) return;
  if (!(await ensurePermission())) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) throw new Error('Missing EAS project id; push tokens need it.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.from('household_members').update({ expo_push_token: token, push_platform: Platform.OS === 'ios' ? 'ios' : 'android' }).eq('user_id', userId);
  if (error) throw error;
}

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

/** Weekly planning nudge on the household's planning day. */
export async function schedulePlanningReminder(enabled: boolean, planningDay: number, time: string) {
  if (!remindersAvailable) return;
  await Notifications.cancelScheduledNotificationAsync(PLANNING_ID).catch(() => {});
  if (!enabled || !(await ensurePermission())) return;
  const { hour, minute } = parseTime(time);
  await Notifications.scheduleNotificationAsync({
    identifier: PLANNING_ID,
    content: { title: 'Plan the week', body: 'Take a few minutes to plan meals for the week ahead.', sound: 'default', data: { kind: 'planning' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: planningDay + 1, hour, minute, channelId: CHANNEL },
  });
}

/** Dinner reminders for the next 7 days that have a plan entry, with the actual meal in the text. */
export async function scheduleDinnerReminders(enabled: boolean, time: string, entries: PlanEntry[]) {
  if (!remindersAvailable) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(DINNER_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!enabled || !(await ensurePermission())) return;
  const { hour, minute } = parseTime(time);
  const today = toISODate(new Date());
  const horizon = toISODate(addDays(new Date(), 7));
  const byDate = new Map<string, PlanEntry[]>();
  for (const e of entries) {
    if (e.date < today || e.date > horizon || e.cooked_at) continue;
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  for (const [date, list] of byDate) {
    const at = fromISODate(date);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= Date.now()) continue;
    const meals = list.map(entryTitle);
    const body = list.every((e) => e.kind !== 'recipe') ? `Tonight: ${meals.join(', ')}.` : `Tonight: ${meals.join(', ')}. Anything to thaw or prep?`;
    await Notifications.scheduleNotificationAsync({
      identifier: `${DINNER_PREFIX}${date}`,
      content: { title: "Tonight's dinner", body, sound: 'default', data: { kind: 'dinner', date } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}
