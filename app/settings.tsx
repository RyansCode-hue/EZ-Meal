import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { useHousehold, useRotateInviteCode, useUpdateHouseholdSettings, useUpdateMyPreferences } from '@/household/useHousehold';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { remindersAvailable } from '@/notifications';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function Settings() {
  const { signOut, session } = useAuth();
  const { household, members, me } = useHousehold();
  const rotate = useRotateInviteCode();
  const prefs = useUpdateMyPreferences();
  const settings = useUpdateHouseholdSettings();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planningTime, setPlanningTime] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const fail = (e: unknown) => setError(describeError(e));

  useEffect(() => {
    if (household) {
      setPlanningTime(household.planning_time.slice(0, 5));
      setDinnerTime(household.dinner_reminder_time.slice(0, 5));
    }
  }, [household?.planning_time, household?.dinner_reminder_time]);

  if (!household || !me) return null;

  function saveTime(field: 'planning_time' | 'dinner_reminder_time', value: string) {
    if (!TIME_RE.test(value)) return setError('Use a 24-hour time like 10:00 or 15:30.');
    setError(null);
    settings.mutate({ [field]: value.padStart(5, '0') }, { onError: fail });
  }

  async function changePassword() {
    if (newPassword.length < 8) return setError('Use a password of at least 8 characters.');
    setChangingPassword(true);
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (e) return fail(e);
    setNewPassword('');
    setNotice('Password changed.');
  }

  return (
    <Screen scroll header>
      <Text style={type.title}>{household.name}</Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {notice ? <Notice kind="info">{notice}</Notice> : null}

      <View style={styles.card}>
        <Text style={type.label}>Invite code</Text>
        <Text style={styles.code} selectable>
          {household.invite_code}
        </Text>
        <Text style={type.small}>Share this so your partner can join. Rotate it if it leaks.</Text>
        <Button title="Rotate code" variant="secondary" loading={rotate.isPending} onPress={() => rotate.mutateAsync().catch(fail)} />
      </View>

      <View style={styles.card}>
        <Text style={type.label}>Members</Text>
        {members.map((m) => (
          <Text key={m.user_id} style={type.body}>
            {m.display_name}
            {m.user_id === session?.user.id ? ' (you)' : ''}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={type.label}>Week</Text>
        <Text style={type.body}>Starts on {WEEKDAY_LONG[household.week_start_day]}</Text>
        <View style={styles.chips}>
          {WEEKDAY_SHORT.map((d, i) => (
            <Chip key={d} label={d} active={household.week_start_day === i} onPress={() => settings.mutate({ week_start_day: i }, { onError: fail })} />
          ))}
        </View>
        <Text style={type.small}>The planner and the grocery list's "this week" follow this.</Text>
      </View>

      <View style={styles.card}>
        <Text style={type.label}>Reminders</Text>
        {!remindersAvailable ? <Notice kind="info">Reminders arrive on the phone app. Settings made here still apply there.</Notice> : null}
        <Row title="Plan the week" sub={`${WEEKDAY_LONG[household.planning_day]} at ${household.planning_time.slice(0, 5)}`} value={me.remind_planning} onChange={(v) => prefs.mutate({ remind_planning: v }, { onError: fail })} />
        <Text style={type.small}>Planning day</Text>
        <View style={styles.chips}>
          {WEEKDAY_SHORT.map((d, i) => (
            <Chip key={d} label={d} active={household.planning_day === i} onPress={() => settings.mutate({ planning_day: i }, { onError: fail })} />
          ))}
        </View>
        <TextField label="Planning reminder time" value={planningTime} onChangeText={setPlanningTime} onBlur={() => saveTime('planning_time', planningTime)} placeholder="10:00" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} hint="24-hour, shared by both of you" />
        <Row title="Tonight's dinner" sub={`Every day at ${household.dinner_reminder_time.slice(0, 5)}, with what is planned`} value={me.remind_dinner} onChange={(v) => prefs.mutate({ remind_dinner: v }, { onError: fail })} />
        <TextField label="Dinner reminder time" value={dinnerTime} onChangeText={setDinnerTime} onBlur={() => saveTime('dinner_reminder_time', dinnerTime)} placeholder="15:00" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} />
        <Row title="Partner activity" sub="When your partner adds or changes a meal" value={me.notify_partner} onChange={(v) => prefs.mutate({ notify_partner: v }, { onError: fail })} />
      </View>

      <View style={styles.card}>
        <Text style={type.label}>Account</Text>
        <Text style={type.small}>{session?.user.email}</Text>
        <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters" />
        <Button title="Change password" variant="secondary" loading={changingPassword} disabled={!newPassword} onPress={changePassword} />
        <Button title="Sign out" variant="danger" onPress={() => signOut().catch(fail)} />
      </View>
    </Screen>
  );
}

function Row({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={type.small}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.ruleStrong }} thumbColor={colors.surface} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule },
  code: { fontFamily: fonts.heading, fontSize: 32, letterSpacing: 4, color: colors.accent, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
