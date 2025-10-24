import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Input } from './Input';
import { useForm } from '@/hooks/use-form';

jest.mock('@/hooks/use-form', () => ({
  useForm: jest.fn(),
}));

describe('Input Component', () => {
  const setUp = (props = {}, maskSchema = {}, formValue = '') => {
    const setValueMock = jest.fn();

    (useForm as jest.Mock).mockReturnValue({
      register: jest.fn().mockReturnValue({
        ref: jest.fn(),
        onChange: jest.fn(),
        name: 'test',
      }),
      setValue: setValueMock,
      maskSchema,
      form: { test: formValue },
    });

    const utils = render(<Input fieldName="test" {...props} />);
    return { ...utils, setValueMock };
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

    const { container, setValueMock } = setUp({}, maskSchema);

    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(setValueMock).toHaveBeenCalledWith('test', 'TEST VALUE');
  });

  it('should render variables in overlay if value has {{variable}}', () => {
    const formValue = 'Hello {{name}}';
    const { container } = setUp({}, {}, formValue);

    const overlayText = screen.getByText('{{name}}');
    expect(overlayText).toBeInTheDocument();

    // Clicar na variável deve ativar modo de edição
    fireEvent.click(overlayText);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toHaveFocus();
  });
});
