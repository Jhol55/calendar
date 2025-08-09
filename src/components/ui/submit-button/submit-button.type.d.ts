import { ButtonHTMLAttributes } from 'react';

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  bgHexColor?: string;
  className?: string;
  children?: React.ReactNode;
  useLoading?: boolean;
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
