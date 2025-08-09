import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FlipCardProps } from './flip-card.type';

export const FlipCard = ({
  renderFront,
  renderBack,
  className,
}: FlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="absolute w-full h-full md:origin-top-left origin-center"
      style={{
        transformStyle: 'preserve-3d',
        transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.6s ease-in-out',
      }}
    >
      <div
        id="front"
        className={cn(
          'absolute flex flex-col justify-center items-center backdrop-blur-lg',
          'rounded-r-3xl md:rounded-l-none rounded-l-3xl w-full h-full z-50',
          className,
        )}
        style={{ backfaceVisibility: 'hidden' }}
      >
        {renderFront && renderFront(isFlipped, setIsFlipped)}
      </div>

      <div
        id="back"
        className={cn(
          'absolute flex flex-col justify-center items-center backdrop-blur-lg',
          'rounded-l-3xl md:rounded-r-none rounded-r-3xl w-full h-full z-50',
          className,
        )}
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        {renderBack && renderBack(isFlipped, setIsFlipped)}
      </div>
    </div>
  );
};
