import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { darkenColor } from '@/utils/darkenColor';
import { MultiVariantButtonProps } from './button.type';
import Image from 'next/image';

const Button = forwardRef<HTMLButtonElement, MultiVariantButtonProps>(
  (
    {
      variant = 'default',
      type = 'button',
      bgHexColor = '#30c18c',
      darkBgHexColor = '',
      darkenFactor = 0.22,
      animated = true,
      className,
      children,
      icon = { src: '', width: 16, height: 16, alt: '' },
      ...props
    },
    ref,
  ) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    const animatedStyle = useMemo(
      () =>
        variant === 'gradient' && animated
          ? 'transition-[background] duration-700 hover:bg-right-top'
          : '',
      [variant, animated],
    );

    const classNames = useMemo(
      () =>
        cn(
          'bg-[280%_auto] w-full text-white text-sm text-center font-medium cursor-pointer rounded-md py-2.5 px-2',
          animatedStyle,
          className,
        ),
      [animatedStyle, className],
    );

    const gradientBackground = useMemo(() => {
      if (variant === 'gradient') {
        const color = isDarkMode ? darkBgHexColor : bgHexColor;
        const darkenedBackgroundColor = darkenColor(color, darkenFactor);
        return `linear-gradient(325deg, ${darkenedBackgroundColor} 0%, ${color} 55%, ${darkenedBackgroundColor} 90%)`;
      }
      return undefined;
    }, [variant, isDarkMode, darkBgHexColor, bgHexColor, darkenFactor]);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        setIsDarkMode(document.body.classList.contains('dark'));
      }
    }, []);

    return (
      <button
        ref={ref}
        type={type}
        className={classNames}
        style={{
          backgroundImage: gradientBackground,
          backgroundColor:
            variant === 'default'
              ? isDarkMode
                ? darkBgHexColor
                : bgHexColor
              : undefined,
        }}
        {...props}
      >
        <span className="relative flex items-center justify-center gap-2">
          {icon.src && (
            <Image
              {...{
                src: icon.src,
                width: icon.width,
                height: icon.height,
                alt: icon.alt,
              }}
            />
          )}
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
