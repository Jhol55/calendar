import { SubmitButton } from '@/components/ui/submit-button';
import { InputProps } from '@/components/ui/input/input.type';
import { ErrorField } from '@/components/ui/error-field';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import React, { useId, useState, useEffect } from 'react';
import { createInstanceFormSchema } from './create-instance.schema';
import { cn } from '@/lib/utils';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { FormControl } from '@/components/ui/form-control';
import { createInstance } from '@/actions/uazapi/instance';
import { initiateCloudInstanceCreation } from '@/actions/whatsapp-official/embedded-signup';
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
  const [provider, setProvider] = useState<string>('default');

  const inputs: (InputProps & { label: string })[] = [
    {
      label: 'Nome da Instância',
      placeholder: 'Minha Instância',
      fieldName: 'name',
      type: 'text',
    },
  ];

  const providerOptions = [
    { value: 'default', label: 'Padrão (Não oficial)' },
    { value: 'cloud', label: 'Cloud (Oficial)' },
  ];

  useEffect(() => {
    // Escutar mensagens do Embedded Signup
    const handleMessage = async (event: MessageEvent) => {
      // Verificar origem da mensagem
      if (!event.origin.includes('facebook.com')) {
        return;
      }

      const data = event.data;

      // Verificar se é uma mensagem do Embedded Signup
      if (data && data.type === 'embedded_signup_complete' && data.code) {
        // O callback criará a instância automaticamente
        // Aqui apenas fechamos o modal e chamamos onSuccess
        if (onSuccess) {
          onSuccess();
        }
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onSuccess]);

  const handleSubmit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    const selectedProvider = data.provider || 'default';

    if (selectedProvider === 'cloud') {
      // Iniciar fluxo OAuth do Facebook para Cloud
      // Passar a URL atual do navegador para garantir que use o domínio correto do ngrok
      const currentOrigin = window.location.origin;
      const response = await initiateCloudInstanceCreation(
        data.name,
        currentOrigin,
      );

      if (!response.success) {
        setError('provider', {
          message:
            response.message || 'Erro ao iniciar conexão com WhatsApp Cloud',
        });
        return;
      }

      // Abrir popup com OAuth
      if (response.data && (response.data as any).oauthUrl) {
        const { oauthUrl } = response.data as { oauthUrl: string };
        const width = 800;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          oauthUrl,
          'WhatsAppCloudSignup',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
        );

        if (!popup) {
          setError('provider', {
            message: 'Por favor, permita popups para este site',
          });
          return;
        }

        // O callback será tratado pelo listener de mensagens
        return;
      }
    } else {
      // Criar instância padrão (Uazapi)
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
        {/* Campo de seleção de provedor */}
        <FormControl variant="label" htmlFor={`${baseId}-provider`}>
          Provedor
        </FormControl>
        <FormSelect
          fieldName="provider"
          placeholder="Selecione o provedor"
          options={providerOptions}
          onValueChange={(value) => setProvider(value)}
        />
        <ErrorField fieldName="provider" />
        <SubmitButton variant="gradient">
          {provider === 'cloud' ? 'Conectar WhatsApp Cloud' : 'Criar Instância'}
        </SubmitButton>
        {children}
        <div className="h-full" /> {/* justify-center when overflow */}
      </Form>
    </div>
  );
};
