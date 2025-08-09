export interface FlipCardProps {
  front?: { children?: React.ReactNode; flipButton?: React.ReactElement };
  back?: { children?: React.ReactNode; flipButton?: React.ReactElement };
  renderFront?: (
    isFlipped: boolean,
    setIsFlipped: Dispatch<SetStateAction<boolean>>,
  ) => React.ReactNode;
  renderBack?: (
    isFlipped: boolean,
    setIsFlipped: Dispatch<SetStateAction<boolean>>,
  ) => React.ReactNode;
  className?: string;
}
