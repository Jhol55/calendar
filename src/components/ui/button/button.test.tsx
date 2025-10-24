import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';
import Image, { ImageProps } from 'next/image';

// Mock do next/image para testes
jest.mock('next/image', () => {
  const MockImage = (props: ImageProps) => <Image {...props} alt="icon" />;
  return { __esModule: true, default: MockImage };
});

describe('Button Component', () => {
  it('renders the button with default styles', () => {
    render(<Button bgHexColor="#30c18c">Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });

    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle({ backgroundColor: 'rgb(48, 193, 140)' });
  });

  it('applies gradient styles when variant is gradient', () => {
    render(
      <Button
        variant="gradient"
        bgHexColor="#30c18c"
        darkBgHexColor="#007f5f"
        animated={false}
      >
        Gradient Button
      </Button>,
    );

    const button = screen.getByRole('button', { name: /gradient button/i });
    expect(button).toHaveStyle(expect.stringMatching(/linear-gradient/));
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

  it('renders icon when provided', () => {
    const icon = { src: '/icon.png', width: 16, height: 16, alt: 'icon' };
    render(<Button icon={icon}>Button with Icon</Button>);

    const img = screen.getByAltText('icon') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/icon.png');
  });
});
