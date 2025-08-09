import { cn } from '@/lib/utils';
import { FormControlProps } from './form-control.type';
import { forwardRef } from 'react';

export const FormControl = forwardRef<
  HTMLLabelElement & HTMLFieldSetElement & HTMLLegendElement,
  FormControlProps
>(({ variant = 'label', className, children, ...props }, ref) => {
  const Component = variant;

  const styles = {
    label: `text-sm font-medium w-fit self-start`,
    legend: '',
    fieldset: '',
  };

  return (
    <Component ref={ref} className={cn(className, styles[variant])} {...props}>
      {children}
    </Component>
  );
});

FormControl.displayName = 'FormControl';
