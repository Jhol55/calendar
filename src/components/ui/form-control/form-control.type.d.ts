import { HTMLAttributes } from 'react';

interface FormControlBaseProps extends HTMLAttributes<HTMLElement> {
  variant: 'label' | 'legend' | 'fieldset';
  className?: string;
  children?: React.ReactNode;
}

interface LabelProps extends FormControlBaseProps {
  variant: 'label';
  htmlFor: string;
}

export type FormControlProps = FormControlBaseProps | LabelProps;
