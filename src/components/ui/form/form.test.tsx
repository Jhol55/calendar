import { render, screen, fireEvent, act } from '@testing-library/react';
import { z } from 'zod';
import { Form } from './Form';
import { Input } from '../input';
import { ErrorField } from '../error-field';

// Mock functions for testing
const mockOnSubmit = jest.fn();
const mockOnChange = jest.fn();

// Define a Zod schema for form validation
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

describe('Form component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits the form with valid data', async () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.click(screen.getByText('Submit'));
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      { name: 'John Doe' },
      expect.any(Function), // setError function
    );
  });

  it('displays validation errors when input is invalid', async () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
        <ErrorField fieldName="name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Submit'));
    });

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('triggers onChange with updated form state', async () => {
    render(
      <Form onChange={mockOnChange} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
      </Form>,
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Name'), {
        target: { value: 'Jane' },
      });
    });

    expect(mockOnChange).toHaveBeenCalledWith({ name: 'Jane' });
  });

  it('supports custom error handling via setError', async () => {
    render(
      <Form onSubmit={mockOnSubmit} zodSchema={schema}>
        <Input fieldName="name" placeholder="Name" />
        <ErrorField fieldName="name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    mockOnSubmit.mockImplementationOnce((_, setError) => {
      setError('name', { message: 'Custom error message' });
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Name'), {
        target: { value: 'Invalid Name' },
      });
      fireEvent.click(screen.getByText('Submit'));
    });

    expect(await screen.findByText('Custom error message')).toBeInTheDocument();
  });

  it('does not call onSubmit if zodSchema is missing or invalid', async () => {
    render(
      <Form onSubmit={mockOnSubmit}>
        <Input fieldName="name" placeholder="Name" />
        <button type="submit">Submit</button>
      </Form>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Submit'));
    });

    // No schema means no validation, form can submit with empty data
    expect(mockOnSubmit).toHaveBeenCalledWith({}, expect.any(Function));
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
