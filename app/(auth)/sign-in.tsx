import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/auth/AuthProvider';
import { describeError } from '@/lib/errors';
import { fonts, colors, space, type } from '@/theme/tokens';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll style={styles.content}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>EZ Meal</Text>
        <Text style={type.bodyMuted}>Sign in to your household.</Text>
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Link href="/(auth)/sign-up" style={styles.link}>
        Have an invite code? Create your account
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', flexGrow: 1 },
  brand: { gap: space.xs, marginBottom: space.lg },
  wordmark: { fontFamily: fonts.heading, fontSize: 44, letterSpacing: -1.2, color: colors.accent },
  link: { textAlign: 'center', color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 15, paddingVertical: space.sm },
});
