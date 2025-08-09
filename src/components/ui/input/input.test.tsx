import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Input } from './Input';
import { useForm } from '@/hooks/use-form';

jest.mock('@/hooks/use-form', () => ({
  useForm: jest.fn(),
}));

describe('Input Component', () => {
  const setUp = (props = {}) => {
    (useForm as jest.Mock).mockReturnValue({
      register: jest.fn().mockReturnValue({
        ref: jest.fn(),
        onChange: jest.fn(),
      }),
      setValue: jest.fn(),
    });

    return render(<Input fieldName="test" {...props} />);
  };

  it('should render the input element correctly', () => {
    setUp();

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should update the value when typing', () => {
    const { container } = setUp();

    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(input.value).toBe('test value');
  });

  it('should call onChange prop when typing', () => {
    const onChangeMock = jest.fn();
    const { container } = setUp({ onChange: onChangeMock });

    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(onChangeMock).toHaveBeenCalledTimes(1);
  });

  it('should apply the mask schema function to input value when provided', () => {
    const maskSchema = {
      test: (e: React.ChangeEvent<HTMLInputElement>) =>
        e.target.value.toUpperCase(),
    };

    const setValue = jest.fn();

    const onChangeMock = jest.fn((e: React.ChangeEvent<HTMLInputElement>) => {
      const type = e.target.type;
      if (!['checkbox', 'radio'].includes(type)) {
        const maskedValue = maskSchema.test(e) ?? e.target.value;
        setValue('test', maskedValue);
      }
    });

    const { container } = setUp({ onChange: onChangeMock });
    const input = container.querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'test value' } });

    expect(setValue).toHaveBeenCalledWith('test', 'TEST VALUE');
  });
});
