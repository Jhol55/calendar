import { useForm } from '@/hooks/use-form';
import { cn } from '@/lib/utils';
import { ErrorFieldProps } from './error-field.type';
import { forwardRef } from 'react';

export const ErrorField = forwardRef<HTMLParagraphElement, ErrorFieldProps>(
  ({ fieldName, className }, ref) => {
    const { errors } = useForm();

    return (
      <p
        ref={ref}
        className={cn(
          'text-red-500 min-h-6 h-6 text-sm self-start leading-none py-2',
          className,
        )}
      >
        {errors[fieldName]?.message as string}
      </p>
    );
  },
);

ErrorField.displayName = 'ErrorField';
