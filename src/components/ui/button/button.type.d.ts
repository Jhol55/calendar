import { ButtonHTMLAttributes } from 'react';

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  bgHexColor?: string;
  darkBgHexColor?: string;
  darkenFactor?: number;
  className?: string;
  children?: React.ReactNode;
  icon?: { src: string; width: number; height: number; alt: string };
}

interface GradientButtonProps extends BaseButtonProps {
  variant?: 'gradient';
  animated?: boolean;
}

interface DefaultButtonProps extends BaseButtonProps {
  variant?: 'default';
  animated?: never | undefined;
}

export type MultiVariantButtonProps = GradientButtonProps | DefaultButtonProps;
