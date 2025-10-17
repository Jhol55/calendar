import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './dialog';

// Mock createPortal
jest.mock('react-dom', () => ({
  createPortal: (node: React.ReactNode) => node,
}));

describe('Dialog', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(screen.getByText('Dialog Content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Dialog isOpen={false} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not show close button when closeButton is false', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} closeButton={false}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked and closeOnOverlayClick is true', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} closeOnOverlayClick={true}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    const overlay =
      screen.getByText('Dialog Content').parentElement?.parentElement;
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });
});
