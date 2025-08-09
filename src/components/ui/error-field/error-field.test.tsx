import { render, screen } from '@testing-library/react';
import { ErrorField } from './error-field';
import { useForm } from '@/hooks/use-form';

// Mock the useForm hook and cast it to the correct type
jest.mock('@/hooks/use-form', () => ({
  useForm: jest.fn(),
}));

describe('ErrorField Component', () => {
  it('renders the error message correctly', () => {
    // Typecast the mocked function to match the expected return type
    (useForm as jest.Mock).mockReturnValue({
      errors: {
        email: { message: 'Email is required' },
      },
    });

    render(<ErrorField fieldName="email" />);
    const errorMessage = screen.getByText('Email is required');
    expect(errorMessage).toBeInTheDocument();
  });

  it('does not render anything when there is no error', () => {
    // Typecast the mocked function to match the expected return type
    (useForm as jest.Mock).mockReturnValue({
      errors: {},
    });

    render(<ErrorField fieldName="email" />);
    const errorMessage = screen.queryByText('Email is required');
    expect(errorMessage).not.toBeInTheDocument();
  });
});
