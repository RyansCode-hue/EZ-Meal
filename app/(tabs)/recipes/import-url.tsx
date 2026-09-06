import { useState } from 'react';
import { Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useImportRecipeUrl } from '@/recipes/hooks';
import { stashDraft } from '@/recipes/draftStore';
import { describeError } from '@/lib/errors';
import { type } from '@/theme/tokens';

export default function ImportUrl() {
  const router = useRouter();
  const importUrl = useImportRecipeUrl();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    setError(null);
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(trimmed)) return setError('Paste the full link, starting with https://.');
    try {
      const draft = await importUrl.mutateAsync(trimmed);
      stashDraft(draft);
      router.replace({ pathname: '/recipes/edit', params: { draft: '1' } });
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Recipe from a link' }} />
      <Screen scroll header>
        <Text style={type.bodyMuted}>Paste a link to a recipe page. The recipe and its photo are read for you to check before saving.</Text>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <TextField
          label="Link"
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          returnKeyType="go"
          onSubmitEditing={onImport}
          editable={!importUrl.isPending}
        />
        <Button title={importUrl.isPending ? 'Reading the page…' : 'Import recipe'} onPress={onImport} loading={importUrl.isPending} disabled={!url.trim()} />
        <Text style={type.small}>Some sites block automated readers. If a link fails, copy the recipe text from the page and use Paste text instead.</Text>
      </Screen>
    </>
  );
}
