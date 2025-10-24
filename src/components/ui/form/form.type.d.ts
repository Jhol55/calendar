import { FormHTMLAttributes } from 'react';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { ZodSchema } from 'zod';

export interface FormProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => void;
  onSubmitSuccessful?: () => void;
  onChange?: (data: FieldValues) => void;
  children: React.ReactNode;
  zodSchema?: ZodSchema;
  maskSchema?:
    | Record<string, (e: React.ChangeEvent<HTMLInputElement>) => void>
    | undefined;
  className?: string;
  delay?: number;
}
