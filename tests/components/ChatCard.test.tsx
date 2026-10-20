import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { emptyDraft } from '@/recipes/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));

const mockSuggest = jest.fn();
jest.mock('@/ideas/hooks', () => ({ useSuggestMeals: () => ({ mutateAsync: mockSuggest, isPending: false }) }));

const mockForget = jest.fn();
jest.mock('@/ideas/notes', () => ({
  useHouseholdNotes: () => ({ data: [], isError: false }),
  useDeleteNote: () => ({ mutate: mockForget }),
  useAddNote: () => ({ mutate: jest.fn(), isPending: false }),
  MAX_NOTE_CHARS: 200,
}));
jest.mock('@/household/useHousehold', () => ({ useHousehold: () => ({ household: { id: 'h1' } }) }));

const { ChatCard } = require('@/ideas/ChatCard');

const book = new Map([['r1', { id: 'r1', title: 'Chicken soup', servings: 4 }]]);

beforeEach(() => {
  mockSuggest.mockReset();
  mockPush.mockReset();
});

describe('ChatCard', () => {
  it('builds a recipe around a tapped protein and shows the reply, ideas, and what it remembered', async () => {
    mockSuggest.mockResolvedValue({
      reply: 'Here are two chicken ideas.',
      existing: [{ recipe_id: 'r1', why: 'Already in your book' }],
      new_recipes: [{ ...emptyDraft('ai'), title: 'Mild chicken tacos' }],
      remembered: [{ id: 'n1', text: 'Does not like spicy food.' }],
      remember_error: null,
    });
    const onPlan = jest.fn();
    const { getByRole, findByText, getByText } = await render(<ChatCard byId={book} onPlan={onPlan} />);
    await fireEvent.press(getByRole('button', { name: 'Chicken' }));
    expect(await findByText('Here are two chicken ideas.')).toBeTruthy();
    expect(mockSuggest).toHaveBeenCalledWith([{ role: 'user', content: 'Build me a new recipe around chicken.' }]);
    expect(getByText('Build me a new recipe around chicken.')).toBeTruthy();
    expect(getByText('Chicken soup')).toBeTruthy();
    expect(getByText('Remembered: Does not like spicy food.')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Open Mild chicken tacos' }));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/recipes/preview' }));
    await fireEvent.press(getByRole('button', { name: 'Add to plan' }));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    await fireEvent.press(getByRole('button', { name: 'Forget: Does not like spicy food.' }));
    expect(mockForget).toHaveBeenCalledWith('n1', expect.anything());
  });

  it('sends the whole conversation on a follow-up', async () => {
    mockSuggest.mockResolvedValueOnce({ reply: 'Try soup.', existing: [], new_recipes: [], remembered: [], remember_error: null });
    mockSuggest.mockResolvedValueOnce({ reply: 'Sure.', existing: [], new_recipes: [], remembered: [], remember_error: null });
    const { getByLabelText, getByRole, findByText } = await render(<ChatCard byId={book} onPlan={jest.fn()} />);
    await fireEvent.changeText(getByLabelText('Message the meal assistant'), 'Something cozy');
    await fireEvent.press(getByRole('button', { name: 'Send' }));
    await findByText('Try soup.');
    await fireEvent.changeText(getByLabelText('Message the meal assistant'), 'Less salt please');
    await fireEvent.press(getByRole('button', { name: 'Send' }));
    await findByText('Sure.');
    expect(mockSuggest).toHaveBeenLastCalledWith([
      { role: 'user', content: 'Something cozy' },
      { role: 'assistant', content: 'Try soup.' },
      { role: 'user', content: 'Less salt please' },
    ]);
  });

  it('puts the message back and shows the error when the assistant fails', async () => {
    mockSuggest.mockRejectedValue(new Error('The assistant is busy.'));
    const { getByLabelText, getByRole, findByText, queryByText } = await render(<ChatCard byId={book} onPlan={jest.fn()} />);
    await fireEvent.changeText(getByLabelText('Message the meal assistant'), 'Pasta night');
    await fireEvent.press(getByRole('button', { name: 'Send' }));
    expect(await findByText(/The assistant is busy/)).toBeTruthy();
    await waitFor(() => expect(getByLabelText('Message the meal assistant').props.value).toBe('Pasta night'));
    expect(queryByText('Pasta night')).toBeNull();
  });
});
