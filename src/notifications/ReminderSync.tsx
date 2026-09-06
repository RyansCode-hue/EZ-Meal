import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useHousehold } from '@/household/useHousehold';
import { addDays, toISODate } from '@/lib/dates';
import { usePlanEntries } from '@/plan/hooks';
import { configureNotifications, registerPushToken, remindersAvailable, scheduleDinnerReminders, schedulePlanningReminder } from './index';

// Keeps the phone's scheduled reminders in step with settings and the plan.
// Runs whenever the plan for the next week or the reminder settings change.
export function ReminderSync() {
  const { session } = useAuth();
  const { household, me } = useHousehold();
  const start = toISODate(new Date());
  const end = toISODate(addDays(new Date(), 7));
  const plan = usePlanEntries(start, end);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (!remindersAvailable || !session || !me) return;
    registerPushToken(session.user.id).catch((e) => console.error('push token registration failed', e));
  }, [session?.user.id, me?.user_id]);

  useEffect(() => {
    if (!remindersAvailable || !household || !me) return;
    schedulePlanningReminder(me.remind_planning, household.planning_day, household.planning_time).catch((e) => console.error('planning reminder', e));
  }, [household?.planning_day, household?.planning_time, me?.remind_planning]);

  useEffect(() => {
    if (!remindersAvailable || !household || !me || !plan.data) return;
    scheduleDinnerReminders(me.remind_dinner, household.dinner_reminder_time, plan.data).catch((e) => console.error('dinner reminders', e));
  }, [plan.data, household?.dinner_reminder_time, me?.remind_dinner]);

  return null;
}
