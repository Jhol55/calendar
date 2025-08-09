import { HTMLInputTypeAttribute, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldName: string;
  type?: HTMLInputTypeAttribute;
}
