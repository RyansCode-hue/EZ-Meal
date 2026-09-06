import { fireEvent, render } from '@testing-library/react-native';
import { StatusControl } from '@/pantry/StatusControl';

describe('StatusControl', () => {
  it('marks the current status and reports taps', async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(<StatusControl value="low" onChange={onChange} label="Olive oil" />);
    expect(getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(getByRole('radio', { name: 'Out' })).not.toBeChecked();
    await fireEvent.press(getByRole('radio', { name: 'Out' }));
    expect(onChange).toHaveBeenCalledWith('out');
  });
});
