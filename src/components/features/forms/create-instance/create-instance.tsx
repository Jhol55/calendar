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
import { Typography } from '@/components/ui/typography';

// Declarar tipos do Facebook SDK
declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            code?: string;
            accessToken?: string;
          };
          status: string;
        }) => void,
        options: {
          config_id: string;
          response_type?: string;
          override_default_response_type?: boolean;
          scope?: string;
          extras?: string | object;
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const isDevEnvironment = process.env.NODE_ENV === 'development';

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
  const [cloudAccountType, setCloudAccountType] = useState<
    'real' | 'test' | null
  >(isDevEnvironment ? null : 'real');

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

  // Manter state para debug, mas usar ref para evitar closure issues
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [wabaInfo, setWabaInfo] = useState<{
    wabaId: string;
    phoneNumberId: string;
  } | null>(null);

  // Usar ref para evitar problemas de closure
  const wabaInfoRef = React.useRef<{
    wabaId: string;
    phoneNumberId: string;
  } | null>(null);

  // State para PIN de 2FA
  const [twoFactorPin, setTwoFactorPin] = useState<string>('');

  useEffect(() => {
    // Carregar SDK do Facebook
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    // Inicializar SDK do Facebook
    window.fbAsyncInit = function () {
      const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
      if (!appId || !window.FB) return;

      window.FB.init({
        appId: appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v23.0',
      });
    };

    // Escutar mensagens do Embedded Signup (WA_EMBEDDED_SIGNUP)
    const handleMessage = (event: MessageEvent) => {
      // Verificar origem
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;

            // Armazenar IDs para usar no callback (tanto state quanto ref)
            const info = {
              wabaId: waba_id,
              phoneNumberId: phone_number_id,
            };
            setWabaInfo(info);
            wabaInfoRef.current = info;
          }
        }
      } catch {
        // Ignorar erro ao parsear mensagem
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
      const selectedAccountType =
        isDevEnvironment && data.cloudAccountType
          ? (data.cloudAccountType as 'real' | 'test')
          : isDevEnvironment
            ? (cloudAccountType ?? 'real')
            : 'real';

      if (isDevEnvironment && selectedAccountType === 'test') {
        const accessToken = String(data.testAccessToken || '').trim();
        const phoneNumberId = String(data.testPhoneNumberId || '').trim();
        const wabaId = String(data.testWabaId || '').trim();

        try {
          const response = await fetch(
            '/api/whatsapp-official/create-test-instance',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: data.name,
                phoneNumberId,
                wabaId,
                accessToken,
                twoFactorPin: twoFactorPin || undefined,
                accountType: 'test',
              }),
            },
          );

          const result = await response.json();
          if (result.success) {
            if (onSuccess) {
              onSuccess();
            }
          } else {
            setError('provider', {
              message: result.message || 'Erro ao criar instância de teste',
            });
          }
        } catch {
          setError('provider', {
            message: 'Erro ao criar instância de teste',
          });
        }

        return;
      }

      // Usar Facebook SDK para Embedded Signup
      if (!window.FB) {
        setError('provider', {
          message:
            'Facebook SDK não carregado. Aguarde um momento e tente novamente.',
        });
        return;
      }

      const configId =
        process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
      if (!configId) {
        setError('provider', {
          message: 'Config ID do Embedded Signup não configurado',
        });
        return;
      }

      // Armazenar nome da instância para usar após callback
      const instanceName = data.name;
      sessionStorage.setItem('pending_cloud_instance_name', instanceName);

      // Limpar wabaInfo anterior
      setWabaInfo(null);
      wabaInfoRef.current = null;

      // Usar FB.login com Embedded Signup
      try {
        window.FB.login(
          (response) => {
            if (response.authResponse) {
              const code = response.authResponse.code;

              if (!code) {
                setError('provider', {
                  message: 'Erro: Código não foi retornado pelo Facebook',
                });
                return;
              }

              // Aguardar até que wabaInfo seja definido (via postMessage)
              // Dar um timeout de 30 segundos
              let attempts = 0;
              const maxAttempts = 150; // 150 * 200ms = 30 segundos

              const checkWabaInfo = setInterval(() => {
                attempts++;

                if (wabaInfoRef.current) {
                  clearInterval(checkWabaInfo);

                  // Preparar dados com code (backend trocará por token)
                  const requestData = {
                    name: instanceName,
                    code: code,
                    wabaId: wabaInfoRef.current.wabaId,
                    phoneNumberId: wabaInfoRef.current.phoneNumberId,
                    twoFactorPin: twoFactorPin || undefined, // Enviar PIN se fornecido
                  };

                  // Criar instância via API direta (sem trocar código por token)
                  fetch('/api/whatsapp-official/create-instance-sdk', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                  })
                    .then((res) => res.json())
                    .then((result) => {
                      if (result.success) {
                        sessionStorage.removeItem(
                          'pending_cloud_instance_name',
                        );
                        if (onSuccess) {
                          onSuccess();
                        }
                      } else {
                        setError('provider', {
                          message: result.message || 'Erro ao criar instância',
                        });
                      }
                    })
                    .catch(() => {
                      setError('provider', {
                        message: 'Erro ao criar instância Cloud',
                      });
                    });
                } else if (attempts >= maxAttempts) {
                  clearInterval(checkWabaInfo);
                  setError('provider', {
                    message:
                      'Tempo esgotado aguardando confirmação do WhatsApp',
                  });
                }
              }, 200);
            } else {
              setError('provider', {
                message: 'Autenticação cancelada ou falhou',
              });
            }
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: 'whatsapp_business_app_onboarding',
              sessionInfoVersion: '3',
            },
          },
        );
      } catch (error) {
        setError('provider', {
          message:
            'Erro ao iniciar Embedded Signup: ' +
            (error instanceof Error ? error.message : String(error)),
        });
      }

      return;
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
    <div className="w-full max-w-md p-4">
      <div className="my-6" style={{ zoom: 0.9 }}>
        <div className="mb-6">
          <Typography
            variant="h2"
            className="text-2xl font-bold text-center mb-2"
          >
            Criar Nova Instância
          </Typography>
          <Typography variant="p" className="text-neutral-600 text-center">
            Crie uma nova instância para enviar mensagens
          </Typography>
        </div>
        <Form
          className={cn(
            'flex flex-col w-full h-full max-h-[75vh] overflow-y-auto rounded-md p-4 -z-50',
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
            onValueChange={(value) => {
              setProvider(value);
              if (value !== 'cloud') {
                setCloudAccountType(isDevEnvironment ? null : 'real');
              }
            }}
          />
          <ErrorField fieldName="provider" />
          {provider === 'cloud' && isDevEnvironment && (
            <>
              <FormControl variant="label">Tipo de Conta</FormControl>
              <FormSelect
                fieldName="cloudAccountType"
                placeholder="Selecione o tipo de conta"
                options={[
                  { value: 'real', label: 'Conta real (embedded signup)' },
                  { value: 'test', label: 'Conta de teste (token manual)' },
                ]}
                onValueChange={(value) => {
                  const accountType = value as 'real' | 'test';
                  setCloudAccountType(accountType);
                  if (accountType === 'test') {
                    setTwoFactorPin('');
                  }
                }}
              />
              <ErrorField fieldName="cloudAccountType" />
            </>
          )}
          {/* Campo de PIN de 2FA para WhatsApp Cloud (apenas conta real ou produção) */}
          {provider === 'cloud' &&
            (!isDevEnvironment || cloudAccountType === 'real') && (
              <>
                <FormControl variant="label">
                  PIN de Autenticação de Dois Fatores (2FA)
                </FormControl>
                <Input
                  type="text"
                  fieldName="twoFactorPin"
                  placeholder="6 dígitos (recomendado para segurança)"
                  value={twoFactorPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTwoFactorPin(value);
                  }}
                  maxLength={6}
                  autoComplete="off"
                />
                <div className="text-xs text-gray-600 mt-2 mb-6 space-y-1">
                  <p>
                    <strong className="text-gray-700">
                      ✓ Se seu número JÁ TEM 2FA:
                    </strong>{' '}
                    Insira o PIN existente de 6 dígitos
                  </p>
                  <p>
                    <strong className="text-gray-700">
                      ✓ Se seu número NÃO TEM 2FA:
                    </strong>{' '}
                    Crie um PIN de 6 dígitos (será configurado automaticamente)
                  </p>
                </div>
              </>
            )}
          {provider === 'cloud' &&
            isDevEnvironment &&
            cloudAccountType === 'test' && (
              <>
                <div className="mt-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 p-3 space-y-3">
                  <Typography
                    variant="span"
                    className="text-sm font-semibold text-neutral-700 uppercase tracking-wide"
                  >
                    Conta de Teste
                  </Typography>
                  <Typography variant="p" className="text-sm text-neutral-700">
                    Informe os dados da conta de teste do WhatsApp Cloud (Public
                    Test Number). Esses dados são usados apenas em ambiente de
                    desenvolvimento.
                  </Typography>
                  <div>
                    <FormControl variant="label">Access Token *</FormControl>
                    <Input
                      type="text"
                      fieldName="testAccessToken"
                      placeholder="EAAJZ..."
                      autoComplete="off"
                    />
                    <ErrorField fieldName="testAccessToken" />
                  </div>
                  <div>
                    <FormControl variant="label">Phone Number ID *</FormControl>
                    <Input
                      type="text"
                      fieldName="testPhoneNumberId"
                      placeholder="123456789012345"
                      autoComplete="off"
                    />
                    <ErrorField fieldName="testPhoneNumberId" />
                  </div>
                  <div>
                    <FormControl variant="label">WABA ID *</FormControl>
                    <Input
                      type="text"
                      fieldName="testWabaId"
                      placeholder="987654321098765"
                      autoComplete="off"
                    />
                    <ErrorField fieldName="testWabaId" />
                  </div>
                </div>
              </>
            )}
          <SubmitButton variant="gradient">
            {provider === 'cloud'
              ? 'Conectar WhatsApp Cloud'
              : 'Criar Instância'}
          </SubmitButton>
          {children}
          <div className="h-full" /> {/* justify-center when overflow */}
        </Form>
      </div>
    </div>
  );
};
