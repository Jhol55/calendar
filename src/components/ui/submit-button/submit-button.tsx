import { useState, forwardRef, useEffect } from 'react';
import { Button } from '../button';
import { MultiVariantButtonProps } from './submit-button.type';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from '@/hooks/use-form';

const SubmitButton = forwardRef<HTMLButtonElement, MultiVariantButtonProps>(
  ({ type = 'submit', useLoading = true, children, ...props }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const { isSubmitting, isSubmitSuccessful, reset } = useForm();

    useEffect(() => {
      const timeout = setTimeout(() => {
        if (isSubmitSuccessful) {
          reset();
        }
      }, 500);

      return () => clearTimeout(timeout);
    }, [isSubmitSuccessful, reset]);

    useEffect(() => {
      const timeout = setTimeout(() => {
        setIsLoading(isSubmitting || isSubmitSuccessful);
      }, 400);

      return () => clearTimeout(timeout);
    }, [isSubmitSuccessful, isSubmitting]);

    return (
      <Button ref={ref} type={type} {...props}>
        <div className="flex justify-center items-center">
          <Loader2
            className={cn(
              useLoading && isLoading ? 'animate-spin' : 'hidden',
              'h-4',
            )}
          />
          {children}
        </div>
      </Button>
    );
  },
);

SubmitButton.displayName = 'SubmitButton';

export { SubmitButton };
