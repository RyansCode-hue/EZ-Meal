import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';

export const MAX_MEAL_NAME = 80;

// Names a plan entry that has no recipe behind it ("Tacos", "Leftovers").
// Used to add one and to rename one.
export function NameMealSheet({
  visible,
  title,
  initial = '',
  action,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initial?: string;
  action: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const tooLong = trimmed.length > MAX_MEAL_NAME;
  const submit = () => {
    if (!trimmed || tooLong) return;
    onSubmit(trimmed);
    setName('');
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <TextField
        label="Meal"
        value={name}
        onChangeText={setName}
        placeholder="Tacos"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        error={tooLong ? `Keep it under ${MAX_MEAL_NAME} characters.` : null}
        hint="No recipe needed. It shows on the plan as written."
      />
      <Button title={action} loading={busy} disabled={!trimmed || tooLong} onPress={submit} />
    </BottomSheet>
  );
}
