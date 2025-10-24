import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Form } from './Form';
import { Input } from '../input';
import { ErrorField } from '../error-field';

const mockOnSubmit = jest.fn();
const mockOnChange = jest.fn();

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

describe('Form component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits the form with valid data', async () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema} delay={0}>
        <Input fieldName="name" placeholder="Name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    const input = screen.getByPlaceholderText('Name');
    const button = screen.getByText('Submit');

    fireEvent.change(input, { target: { value: 'John Doe' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        { name: 'John Doe' },
        expect.any(Function),
      );
    });
  });

  it('displays validation errors when input is invalid', async () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema} delay={0}>
        <Input fieldName="name" placeholder="Name" />
        <ErrorField fieldName="name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    const button = screen.getByText('Submit');

    fireEvent.click(button);

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('triggers onChange with updated form state', async () => {
    render(
      <Form onChange={mockOnChange} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
      </Form>,
    );

    const input = screen.getByPlaceholderText('Name');

    fireEvent.change(input, { target: { value: 'Jane' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: 'Jane' });
    });
  });

  it('supports custom error handling via setError', async () => {
    mockOnSubmit.mockImplementationOnce((_, setError) => {
      setError('name', { message: 'Custom error message' });
    });

    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema} delay={0}>
        <Input fieldName="name" placeholder="Name" />
        <ErrorField fieldName="name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    const input = screen.getByPlaceholderText('Name');
    const button = screen.getByText('Submit');

    fireEvent.change(input, { target: { value: 'Invalid Name' } });
    fireEvent.click(button);

    expect(await screen.findByText('Custom error message')).toBeInTheDocument();
  });

  it('submits even without zodSchema', async () => {
    render(
      <Form onSubmit={mockOnSubmit} delay={0}>
        <Input fieldName="name" placeholder="Name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    const button = screen.getByText('Submit');

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({}, expect.any(Function));
    });
  });

  it('renders additional components within the form', () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
        <ErrorField fieldName="name" />
        <div data-testid="extra-component">Extra Component</div>
        <button type="submit">Submit</button>
      </Form>,
    );

    expect(screen.getByTestId('extra-component')).toBeInTheDocument();
  });
});
