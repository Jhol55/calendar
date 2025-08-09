import { HTMLAttributes } from 'react';

export interface ControlledInputOTPSlotProps
  extends HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
  className?: string;
  fakeCaretClassName?: string;
  children?: React.ReactNode;
}
