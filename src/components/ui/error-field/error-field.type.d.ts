import { HTMLAttributes } from 'react';

export interface ErrorFieldProps extends HTMLAttributes<HTMLParagraphElement> {
  fieldName: string;
  // children: string | FieldError | Merge<FieldError, FieldErrorsImpl<Record<string, unknown>>> | undefined
}
