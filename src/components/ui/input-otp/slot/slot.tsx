import { cn } from '@/lib/utils';
import { FakeCaret } from '../fake-caret';
import { forwardRef } from 'react';
import { ControlledInputOTPSlotProps } from './slot.type';

export const Slot = forwardRef<HTMLDivElement, ControlledInputOTPSlotProps>(
  ({ isActive, className, fakeCaretClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative w-10 h-12 text-lg',
          'flex items-center justify-center',
          'transition-all duration-100',
          'border-border border-y border-r first:border-l first:rounded-l-md last:rounded-r-md',
          'outline outline-0 outline-accent-foreground/20',
          { 'outline-3 outline-emerald-400 border-emerald-400 z-10': isActive },
          className,
        )}
        {...props}
      >
        {children}
        <FakeCaret isActive={isActive} className={fakeCaretClassName} />
      </div>
    );
  },
);

Slot.displayName = 'Slot';
