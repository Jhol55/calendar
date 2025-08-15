import { useState, forwardRef, useEffect } from 'react';
import { Button } from '../button';
import { MultiVariantButtonProps } from './submit-button.type';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from '@/hooks/use-form';

const SubmitButton = forwardRef<HTMLButtonElement, MultiVariantButtonProps>(
  ({ type = 'submit', useLoading = true, children, ...props }, ref) => {
    const { isSubmitting, isSubmitSuccessful, reset, errors } = useForm();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      setIsLoading(useLoading && isSubmitting);

      if (isSubmitSuccessful && !errors) {
        const timeout = setTimeout(() => {
          reset();
          setIsLoading(true);
        }, 3000);
        return () => clearTimeout(timeout);
      }
    }, [isSubmitting, isSubmitSuccessful, reset, useLoading, errors]);

    return (
      <Button ref={ref} type={type} {...props}>
        <div className="flex justify-center items-center transition-all duration-300">
          <Loader2
            className={cn(
              useLoading && isLoading
                ? 'animate-spin opacity-100'
                : 'opacity-0',
              'h-4 w-4 transition-opacity duration-300',
            )}
          />
          <span
            className={cn(
              useLoading && isLoading ? 'translate-x-1' : 'translate-x-0',
              'transition-transform duration-300',
            )}
          >
            {children}
          </span>
        </div>
      </Button>
    );
  },
);

SubmitButton.displayName = 'SubmitButton';

export { SubmitButton };
