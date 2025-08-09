import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button Component', () => {
  it('renders the button with default styles', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle('background-color: #30c18c');
  });

  it('applies gradient styles when variant is gradient', () => {
    render(<Button variant="gradient">Gradient Button</Button>);
    const button = screen.getByRole('button', { name: /gradient button/i });
    expect(button).toHaveStyle({
      backgroundImage: expect.stringMatching(/linear-gradient/),
    });
  });

  it('handles onClick event', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable Button</Button>);
    const button = screen.getByRole('button', { name: /clickable button/i });
    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders children correctly', () => {
    render(<Button>Child Content</Button>);
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});
