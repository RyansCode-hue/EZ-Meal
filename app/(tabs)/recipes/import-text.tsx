import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useParseRecipeText } from '@/recipes/hooks';
import { stashDraft } from '@/recipes/draftStore';
import { describeError } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme/tokens';

export default function ImportText() {
  const router = useRouter();
  const parse = useParseRecipeText();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onParse() {
    setError(null);
    if (text.trim().length < 20) return setError('Paste the whole recipe, including the ingredients.');
    try {
      const draft = await parse.mutateAsync(text);
      stashDraft(draft);
      router.replace({ pathname: '/recipes/edit', params: { draft: '1' } });
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Paste a recipe' }} />
      <Screen scroll header>
        <Text style={type.bodyMuted}>Paste a recipe from a message, a note, or a website. It will be read into ingredients and steps for you to check before saving.</Text>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={'Grandma\'s Chili\nServes 6\n\n2 lb ground beef\n1 onion, diced\n...'}
          placeholderTextColor={colors.muted}
          style={styles.textarea}
          textAlignVertical="top"
          autoCorrect={false}
          accessibilityLabel="Recipe text"
          editable={!parse.isPending}
        />
        <Button title={parse.isPending ? 'Reading your recipe…' : 'Read recipe'} onPress={onParse} loading={parse.isPending} disabled={!text.trim()} />
        <View style={styles.tips}>
          <Text style={type.small}>Include the title and servings if you have them. Long articles work too, the assistant finds the recipe inside.</Text>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  textarea: {
    minHeight: 280,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  tips: { paddingHorizontal: space.xs },
});
