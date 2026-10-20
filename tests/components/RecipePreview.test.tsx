import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { holdPreview, getPreview } from '@/recipes/draftStore';
import { emptyDraft } from '@/recipes/types';

const mockReplace = jest.fn();
let mockParams: { key?: string } = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockSave = jest.fn();
jest.mock('@/recipes/hooks', () => ({
  useSaveRecipe: () => ({ mutateAsync: mockSave, isPending: false }),
}));

// Imported after the mocks so the screen picks them up.
const RecipePreview = require('../../app/(tabs)/recipes/preview').default;

const idea = () => ({
  ...emptyDraft('ai'),
  title: 'Lemon chicken',
  servings: 2,
  ingredients: [{ quantity: 1, unit: 'lb', name: 'chicken thighs', preparation: null, canonical_name: 'chicken thigh', store_section: 'meat_seafood' as const }],
  steps: [{ text: 'Roast until done.' }],
});

beforeEach(() => {
  mockReplace.mockReset();
  mockSave.mockReset();
});

describe('RecipePreview', () => {
  it('shows the full idea and saves it as a recipe, then opens the saved recipe', async () => {
    const key = holdPreview(idea());
    mockParams = { key };
    mockSave.mockResolvedValue('new-id');
    const { getByText, getByRole } = await render(<RecipePreview />);
    expect(getByText('Lemon chicken')).toBeTruthy();
    expect(getByText('chicken thighs')).toBeTruthy();
    expect(getByText('Roast until done.')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Save as a recipe' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/recipes/new-id'));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lemon chicken' }));
    expect(getPreview(key)?.savedId).toBe('new-id');
  });

  it('shows the error and stays on the page when saving fails', async () => {
    mockParams = { key: holdPreview(idea()) };
    mockSave.mockRejectedValue(new Error('network down'));
    const { getByRole, findByText } = await render(<RecipePreview />);
    await fireEvent.press(getByRole('button', { name: 'Save as a recipe' }));
    expect(await findByText(/network down/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('offers the saved recipe instead of saving twice', async () => {
    const key = holdPreview(idea());
    getPreview(key);
    require('@/recipes/draftStore').markPreviewSaved(key, 'saved-id');
    mockParams = { key };
    const { getByRole, queryByRole } = await render(<RecipePreview />);
    expect(queryByRole('button', { name: 'Save as a recipe' })).toBeNull();
    await fireEvent.press(getByRole('button', { name: 'Open saved recipe' }));
    expect(mockReplace).toHaveBeenCalledWith('/recipes/saved-id');
  });

  it('explains when the idea is no longer held', async () => {
    mockParams = { key: 'gone' };
    const { getByText } = await render(<RecipePreview />);
    expect(getByText('This idea is gone')).toBeTruthy();
  });
});
