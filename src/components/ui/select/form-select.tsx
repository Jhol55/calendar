'use client';

import { useForm } from '@/hooks/use-form';
import { forwardRef, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { FormSelectProps } from './form-select.type';
import { Typography } from '../typography';
import { cn } from '@/lib/utils';

export const FormSelect = forwardRef<HTMLButtonElement, FormSelectProps>(
  (
    {
      fieldName,
      placeholder = 'Selecione...',
      options,
      className,
      disabled,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const { form, setValue, register } = useForm();
    const currentValue = (form[fieldName] as string) || '';
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      register(fieldName);
    }, [fieldName, register]);

    const handleValueChange = (value: string) => {
      setValue(fieldName, value);
      onValueChange?.(value);
    };

    return (
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={setIsOpen}
        {...props}
      >
        <SelectTrigger
          ref={ref}
          className={cn(
            'w-full rounded-md border !h-11 border-gray-300 bg-neutral-100 p-2.5 outline-none text-sm text-black/40',
            isOpen && 'ring-2 ring-[#5c5e5d]',
            className,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-neutral-100">
          {options.map((option) => (
            <SelectItem
              className="hover:cursor-pointer focus-ring-0 hover:bg-neutral-200"
              key={option.value}
              value={option.value}
            >
              <Typography
                variant="span"
                className={cn(currentValue === option.value && 'text-black/80')}
              >
                {option.label}
              </Typography>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);

FormSelect.displayName = 'FormSelect';
