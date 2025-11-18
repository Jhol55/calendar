'use client';

import { useForm } from '@/hooks/use-form';
import { forwardRef, useEffect, useState, useRef } from 'react';
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
    const formValue = (form[fieldName] as string) || '';
    const [currentValue, setCurrentValue] = useState<string>(formValue);
    const [isOpen, setIsOpen] = useState(false);
    const lastFormValueRef = useRef<string>(formValue);

    useEffect(() => {
      register(fieldName);
    }, [fieldName, register]);

    // Observar mudanças no valor do form e atualizar o estado local
    useEffect(() => {
      // Só atualizar se o valor realmente mudou
      if (formValue !== lastFormValueRef.current) {
        lastFormValueRef.current = formValue;
        setCurrentValue(formValue);
      }
    }, [formValue]);

    // Garantir que o valor inicial seja capturado após o mount
    // useEffect(() => {
    //   const timer = setTimeout(() => {
    //     const currentFormValue = (form[fieldName] as string) || '';
    //     if (currentFormValue !== lastFormValueRef.current) {
    //       lastFormValueRef.current = currentFormValue;
    //       setCurrentValue(currentFormValue);
    //     }
    //   }, 0);
    //   return () => clearTimeout(timer);
    // }, [fieldName, form]);

    // Forçar atualização quando o valor do form mudar (incluindo valores vazios)
    useEffect(() => {
      const timer = setTimeout(() => {
        const currentFormValue = (form[fieldName] as string) || '';
        if (currentFormValue !== lastFormValueRef.current) {
          lastFormValueRef.current = currentFormValue;
          setCurrentValue(currentFormValue);
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [formValue, fieldName, form]);

    const handleValueChange = (value: string) => {
      lastFormValueRef.current = value;
      setCurrentValue(value);
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
        <SelectContent className="bg-neutral-100 max-h-[300px] overflow-y-auto">
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
