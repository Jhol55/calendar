import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { TypographyProps } from './typography.type';

export const Typography = forwardRef<HTMLParagraphElement, TypographyProps>(
  (
    {
      className,
      color = 'text-neutral-600',
      variant = 'p',
      children,
      ...props
    },
    ref,
  ) => {
    const Component = variant;

    const styles = {
      p: `text-sm font-medium`,
      b: 'text-sm font-semibold',
      span: `text-sm font-medium`,
      h1: `text-2xl font-bold`,
      h2: `text-2xl font-semibold`,
      h3: `text-xl font-medium`,
      h4: `text-lg font-medium`,
      h5: `text-md font-semibold`,
      h6: `text-md font-medium`,
    };

    return (
      <Component
        ref={ref}
        className={cn(styles[variant], color, className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Typography.displayName = 'Typography';
