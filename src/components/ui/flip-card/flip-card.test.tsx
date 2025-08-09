import { render, fireEvent, waitFor } from '@testing-library/react';
import { FlipCard } from './flip-card';

// Mocking renderFront and renderBack functions
const renderFrontMock = jest.fn();
const renderBackMock = jest.fn();

describe('FlipCard Component', () => {
  it('renders front and back correctly', () => {
    render(
      <FlipCard renderFront={renderFrontMock} renderBack={renderBackMock} />,
    );

    // Ensure that renderFront and renderBack are called
    expect(renderFrontMock).toHaveBeenCalledTimes(1);
    expect(renderBackMock).toHaveBeenCalledTimes(1);
  });

  it('should flip the card when button is clicked', async () => {
    const { container } = render(
      <FlipCard
        renderFront={(isFlipped, setIsFlipped) => {
          renderFrontMock(isFlipped, setIsFlipped);
          return <button onClick={() => setIsFlipped(!isFlipped)}>Flip</button>;
        }}
        renderBack={renderBackMock}
      />,
    );

    // Get the flip card container and the flip button
    const flipCard = container.firstChild as HTMLElement;
    const flipButton = container.querySelector('button') as HTMLButtonElement;

    // Initially, the card should not be flipped
    expect(flipCard.style.transform).toBe('rotateY(0deg)');

    // Simulate the click on the button to flip the card
    fireEvent.click(flipButton);

    // Wait for the transformation to apply (ensure animation completes)
    await waitFor(() => {
      // After clicking, the card should have rotated -180 degrees
      expect(flipCard.style.transform).toBe('rotateY(-180deg)');
    });
  });

  it('applies the correct className to internal divs', () => {
    const { container } = render(
      <FlipCard
        renderFront={renderFrontMock}
        renderBack={renderBackMock}
        className="custom-class"
      />,
    );

    // Select the internal divs
    const frontDiv = container.querySelector('#front') as HTMLElement;
    const backDiv = container.querySelector('#back') as HTMLElement;

    // Check if the "custom-class" was applied to the internal divs
    expect(frontDiv.classList.contains('custom-class')).toBe(true);
    expect(backDiv.classList.contains('custom-class')).toBe(true);
  });

  it('passes isFlipped and setIsFlipped to renderFront and renderBack', async () => {
    const { container } = render(
      <FlipCard
        renderFront={(isFlipped, setIsFlipped) => {
          renderFrontMock(isFlipped, setIsFlipped);
          return <button onClick={() => setIsFlipped(!isFlipped)}>Flip</button>;
        }}
        renderBack={renderBackMock}
      />,
    );

    const flipButton = container.querySelector('button') as HTMLButtonElement;

    // Ensure renderFront is called with isFlipped = false
    expect(renderFrontMock).toHaveBeenCalledWith(false, expect.any(Function));

    // Simulate the click to flip the card
    fireEvent.click(flipButton);

    // After the flip, renderBack should be called with isFlipped = true
    await waitFor(() => {
      expect(renderBackMock).toHaveBeenCalledWith(true, expect.any(Function));
    });
  });
});
