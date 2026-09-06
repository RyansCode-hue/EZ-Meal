import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/auth/AuthProvider';
import { useCreateHousehold, useJoinHousehold } from '@/household/useHousehold';
import { describeError } from '@/lib/errors';
import { fonts, colors, radius, space, type } from '@/theme/tokens';

type Mode = 'create' | 'join';

export default function HouseholdSetup() {
  const { signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold();
  const join = useJoinHousehold();
  const busy = create.isPending || join.isPending;

  async function submit() {
    setError(null);
    if (!displayName.trim()) return setError('Enter your name so your partner knows who did what.');
    try {
      if (mode === 'create') {
        if (!householdName.trim()) return setError('Give your household a name.');
        await create.mutateAsync({ name: householdName, displayName });
      } else {
        if (inviteCode.trim().length < 6) return setError('Enter the invite code from your partner.');
        await join.mutateAsync({ inviteCode, displayName });
      }
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <Screen scroll>
      <Text style={type.title}>Your household</Text>
      <Text style={type.bodyMuted}>
        Create a household, or join one with its invite code.
      </Text>

      <View style={styles.segment} accessibilityRole="tablist">
        <SegmentButton label="Create" active={mode === 'create'} onPress={() => setMode('create')} />
        <SegmentButton label="Join" active={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      {error ? <Notice kind="error">{error}</Notice> : null}

      <TextField label="Your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
      {mode === 'create' ? (
        <TextField
          label="Household name"
          value={householdName}
          onChangeText={setHouseholdName}
          placeholder="e.g. The Ellerbroeks"
          autoCapitalize="words"
        />
      ) : (
        <TextField
          label="Invite code"
          value={inviteCode}
          onChangeText={(v) => setInviteCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="8 characters"
        />
      )}
      <Button title={mode === 'create' ? 'Create household' : 'Join household'} onPress={submit} loading={busy} />
      <Button title="Sign out" variant="secondary" onPress={() => signOut().catch((e) => setError(describeError(e)))} />
    </Screen>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 3,
  },
  segmentButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.accent },
  segmentTextActive: { color: colors.ink },
});
