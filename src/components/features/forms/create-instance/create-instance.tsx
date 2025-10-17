import { SubmitButton } from '@/components/ui/submit-button';
import { InputProps } from '@/components/ui/input/input.type';
import { ErrorField } from '@/components/ui/error-field';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import React, { useId } from 'react';
import { createInstanceFormSchema } from './create-instance.schema';
import { cn } from '@/lib/utils';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { FormControl } from '@/components/ui/form-control';
import { createInstance } from '@/actions/uazapi/instance';
import { Typography } from '@/components/ui/typography';

export const CreateInstanceForm = ({
  className,
  children,
  onSuccess,
}: {
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
}) => {
  const baseId = useId();

  const inputs: (InputProps & { label: string })[] = [
    {
      label: 'Nome da Instância',
      placeholder: 'Minha Instância',
      fieldName: 'name',
      type: 'text',
    },
  ];

  const handleSubmit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    const response = await createInstance(data.name);

    if (!response.success) {
      setError('name', {
        message: response.message || 'Erro ao criar instância',
      });
      return;
    }

    // Chamar callback de sucesso se fornecido
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 mt-6">
        <Typography
          variant="h2"
          className="text-2xl font-bold text-center mb-2"
        >
          Criar Nova Instância
        </Typography>
        <Typography variant="p" className="text-neutral-600 text-center">
          Digite um nome para sua nova instância do WhatsApp
        </Typography>
      </div>
      <Form
        className={cn(
          'flex flex-col gap-2 w-full h-full overflow-y-auto md:rounded-r-3xl rounded-r-3xl p-4 -z-50 bg-neutral-50',
          className,
        )}
        zodSchema={createInstanceFormSchema}
        onSubmit={handleSubmit}
      >
        <div className="h-full" /> {/* justify-center when overflow */}
        {inputs.map((input, index) => (
          <React.Fragment key={index}>
            <FormControl variant="label" htmlFor={`${baseId}-${index}`}>
              {input.label}
            </FormControl>

            <Input
              id={`${baseId}-${index}`}
              type={input.type}
              placeholder={input.placeholder}
              fieldName={input.fieldName}
              autoComplete="off"
            />

            <ErrorField fieldName={input.fieldName} />
          </React.Fragment>
        ))}
        <SubmitButton variant="gradient">Criar Instância</SubmitButton>
        {children}
        <div className="h-full" /> {/* justify-center when overflow */}
      </Form>
    </div>
  );
};
