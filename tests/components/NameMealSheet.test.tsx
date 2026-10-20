import { fireEvent, render } from '@testing-library/react-native';
import { NameMealSheet } from '@/plan/NameMealSheet';

describe('NameMealSheet', () => {
  it('submits the trimmed name', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByPlaceholderText, getByText } = await render(<NameMealSheet visible title="Add a meal" action="Add to plan" onClose={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent.changeText(getByPlaceholderText('Tacos'), '  Tacos  ');
    await fireEvent.press(getByText('Add to plan'));
    expect(onSubmit).toHaveBeenCalledWith('Tacos');
    expect(getByLabelText).toBeTruthy();
  });
  it('does not submit a blank or overlong name', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = await render(<NameMealSheet visible title="Add a meal" action="Add to plan" onClose={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent.press(getByText('Add to plan'));
    await fireEvent.changeText(getByPlaceholderText('Tacos'), 'x'.repeat(81));
    expect(getByText('Keep it under 80 characters.')).toBeTruthy();
    await fireEvent.press(getByText('Add to plan'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
