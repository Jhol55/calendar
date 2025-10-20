'use client';

import React, { forwardRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProps } from './form.type';
import { FormProvider } from '@/contexts/form';

export const Form = forwardRef<HTMLFormElement, FormProps>(
  (
    {
      onSubmit,
      onSubmitSuccessful,
      onChange,
      children,
      zodSchema,
      maskSchema,
      className,
      autoComplete = 'on',
      ...props
    },
    ref,
  ) => {
    const {
      register,
      watch,
      handleSubmit,
      setError,
      setValue,
      reset,
      formState: { errors, isSubmitting, isSubmitSuccessful },
    } = useForm({
      resolver: zodSchema ? zodResolver(zodSchema) : undefined,
    });

    const form = watch();

    useEffect(() => {
      onChange?.(form);
    }, [form, onChange]);

    useEffect(() => {
      if (isSubmitSuccessful) {
        onSubmitSuccessful?.();
      }
    }, [isSubmitSuccessful, onSubmitSuccessful]);

    return (
      <FormProvider
        value={{
          register,
          setError,
          errors,
          maskSchema,
          form,
          setValue,
          reset,
          isSubmitting,
          isSubmitSuccessful,
        }}
      >
        <form
          ref={ref}
          onSubmit={handleSubmit(async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            onSubmit?.(form, setError);
          })}
          className={className}
          autoComplete={autoComplete}
          {...props}
        >
          {children}
        </form>
      </FormProvider>
    );
  },
);

Form.displayName = 'Form';
