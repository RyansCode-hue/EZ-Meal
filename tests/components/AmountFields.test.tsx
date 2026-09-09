import { fireEvent, render } from '@testing-library/react-native';
import { AmountFields } from '@/pantry/AmountFields';

describe('AmountFields', () => {
  it('lights the chip matching the typed unit, including aliases', async () => {
    const { getByRole } = await render(<AmountFields amount="2" unit="lbs" onAmountChange={jest.fn()} onUnitChange={jest.fn()} />);
    expect(getByRole('button', { name: 'lb' })).toBeSelected();
    expect(getByRole('button', { name: 'oz' })).not.toBeSelected();
  });
  it('sets the unit from a chip and clears it when the lit chip is tapped again', async () => {
    const onUnitChange = jest.fn();
    const { getByRole } = await render(<AmountFields amount="" unit="lb" onAmountChange={jest.fn()} onUnitChange={onUnitChange} />);
    await fireEvent.press(getByRole('button', { name: 'oz' }));
    expect(onUnitChange).toHaveBeenLastCalledWith('oz');
    await fireEvent.press(getByRole('button', { name: 'lb' }));
    expect(onUnitChange).toHaveBeenLastCalledWith('');
  });
  it('shows the validation message under the amount', async () => {
    const { getByText } = await render(<AmountFields amount="two" unit="" onAmountChange={jest.fn()} onUnitChange={jest.fn()} error="Use a number like 2, 1.5, or 1/2." />);
    expect(getByText('Use a number like 2, 1.5, or 1/2.')).toBeTruthy();
  });
});
