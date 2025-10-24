import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dialog } from './dialog';

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  cb(0);
  return 0;
});

describe('Dialog', () => {
  let mockOnClose: jest.Mock;

  beforeEach(() => {
    mockOnClose = jest.fn();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
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

  it('calls onClose when close button is clicked', async () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    await waitFor(() => {
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
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

    // Encontrar o overlay (div com backdrop-blur-sm)
    const overlay = document.querySelector('.backdrop-blur-sm');

    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('does not call onClose when overlay is clicked and closeOnOverlayClick is false', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} closeOnOverlayClick={false}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    const overlay = document.querySelector('.backdrop-blur-sm');

    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('calls onClose when Escape key is pressed and closeOnEscape is true', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} closeOnEscape={true}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape key is pressed and closeOnEscape is false', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('sets body overflow to hidden when dialog is open', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when dialog is closed', () => {
    const { rerender } = render(
      <Dialog isOpen={true} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Dialog isOpen={false} onClose={mockOnClose}>
        <div>Dialog Content</div>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('unset');
  });

  it('applies custom className to dialog container', () => {
    render(
      <Dialog isOpen={true} onClose={mockOnClose} className="custom-class">
        <div>Dialog Content</div>
      </Dialog>,
    );

    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('applies custom contentClassName to dialog content', () => {
    render(
      <Dialog
        isOpen={true}
        onClose={mockOnClose}
        contentClassName="custom-content"
      >
        <div>Dialog Content</div>
      </Dialog>,
    );

    const content = document.querySelector('.custom-content');
    expect(content).toBeInTheDocument();
  });
});
