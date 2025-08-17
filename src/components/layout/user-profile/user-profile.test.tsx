import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from './user-profile';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock the useOutsideClick hook
jest.mock('@/hooks/use-outside-click', () => ({
  useOutsideClick: jest.fn(),
}));

describe('UserProfile', () => {
  const defaultProps = {
    user: {
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  it('renders user profile with avatar and name', () => {
    render(<UserProfile {...defaultProps} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('TU')).toBeInTheDocument(); // Initials
  });

  it('opens dropdown when avatar is clicked', () => {
    render(<UserProfile {...defaultProps} />);

    const avatarButton = screen.getByRole('button');
    fireEvent.click(avatarButton);

    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Tema')).toBeInTheDocument();
    expect(screen.getByText('Sair')).toBeInTheDocument();
  });

  it('calls onLogout when logout option is clicked', () => {
    const onLogout = jest.fn();
    render(<UserProfile {...defaultProps} onLogout={onLogout} />);

    const avatarButton = screen.getByRole('button');
    fireEvent.click(avatarButton);

    const logoutButton = screen.getByText('Sair');
    fireEvent.click(logoutButton);

    expect(onLogout).toHaveBeenCalled();
  });

  it('displays user avatar image when provided', () => {
    const propsWithAvatar = {
      ...defaultProps,
      user: {
        ...defaultProps.user,
        avatar: 'https://example.com/avatar.jpg',
      },
    };

    render(<UserProfile {...propsWithAvatar} />);

    const avatarImage = screen.getByAltText('Test User');
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg',
    );
  });

  it('generates initials correctly from name', () => {
    const propsWithFullName = {
      user: {
        name: 'João Silva Santos',
        email: 'joao@example.com',
      },
    };

    render(<UserProfile {...propsWithFullName} />);

    expect(screen.getByText('JS')).toBeInTheDocument(); // Should show first two initials
  });
});
