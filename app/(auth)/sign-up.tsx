import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/functions';
import { describeError } from '@/lib/errors';
import { colors, fonts, space, type } from '@/theme/tokens';

// Accounts are created only with an invite code from an existing household.
// The redeem-invite function creates the account and joins it in one step,
// then the app signs in normally.
export default function SignUp() {
  const { signIn } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (inviteCode.trim().length < 6) return setError('Enter the invite code from your household.');
    if (!displayName.trim()) return setError('Enter your name.');
    if (!email.trim()) return setError('Enter an email address.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('redeem-invite', {
        body: { invite_code: inviteCode.trim().toUpperCase(), email: email.trim(), password, display_name: displayName.trim() },
      });
      if (fnError) throw await describeFunctionError(fnError, 'Account creation');
      await signIn(email, password);
      // The root gate sees the session and the membership and moves into the app.
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll style={styles.content}>
      <View style={styles.brand}>
        <Text style={type.title}>Join your household</Text>
        <Text style={type.bodyMuted}>You need the invite code from the people icon in your partner's app.</Text>
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <TextField label="Invite code" value={inviteCode} onChangeText={(v) => setInviteCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="8 characters" />
      <TextField label="Your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters" />
      <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} returnKeyType="go" />
      <Button title="Create account and join" onPress={submit} loading={busy} />
      <Link href="/(auth)/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}


const styles = StyleSheet.create({
  content: { justifyContent: 'center', flexGrow: 1 },
  brand: { gap: space.xs, marginBottom: space.sm },
  link: { textAlign: 'center', color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 15, paddingVertical: space.sm },
});
