'use client';

import { useForm } from '@/hooks/use-form';
import { TextareaProps } from './textarea.type';
import { forwardRef } from 'react';
import { mergeRefs } from '@/utils/mergeRefs';
import { cn } from '@/lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ fieldName, className, onChange, ...props }, ref) => {
    const { register, setValue } = useForm();
    const {
      ref: registerRef,
      onChange: registerOnChange,
      ...registerProps
    } = register(fieldName);

    const handleOnChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValue(fieldName, value);
      registerOnChange?.(e);
      onChange?.(e);
    };

    const defaultStyle =
      'w-full rounded-md border border-gray-300 bg-neutral-100 p-2.5 text-black outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm resize-none';

    return (
      <textarea
        ref={mergeRefs(ref, registerRef)}
        onChange={handleOnChange}
        className={cn(defaultStyle, className)}
        {...props}
        {...registerProps}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
