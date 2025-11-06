'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import {
  exchangeWhatsAppToken,
  getWhatsAppOfficialStatus,
  disableWhatsAppOfficial,
} from '@/actions/whatsapp-official/embedded-signup';
import { useUser } from '@/hooks/use-user';
import { Settings, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface WhatsAppOfficialConfigProps {
  isOpen: boolean;
  onClose: () => void;
  instanceToken: string;
  instanceName: string;
}

interface FacebookSDK {
  init: (config: { appId: string; version: string; xfbml: boolean }) => void;
  getLoginStatus: (callback: (response: unknown) => void) => void;
  login: (
    callback: (response: unknown) => void,
    options?: { scope?: string },
  ) => void;
  logout: (callback: () => void) => void;
}

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppOfficialConfig({
  isOpen,
  onClose,
  instanceToken,
  instanceName,
}: WhatsAppOfficialConfigProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    enabled: boolean;
    status: string;
    phoneNumber?: string;
    connectedAt?: Date;
  } | null>(null);
  const { handleUpdate } = useUser();

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }

    // Cleanup: remover listener quando componente desmontar
    return () => {
      window.removeEventListener('message', handleEmbeddedSignupCallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, instanceToken]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const response = await getWhatsAppOfficialStatus(instanceToken);
      if (response.success && response.data) {
        const data = response.data as {
          enabled: boolean;
          status: string;
          phoneNumber?: string;
          connectedAt?: Date;
        };
        setStatus(data);
      } else {
        setStatus({
          enabled: false,
          status: 'disconnected',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
      setStatus({
        enabled: false,
        status: 'disconnected',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const listenForEmbeddedSignupMessage = () => {
    // Escutar mensagens do Embedded Signup
    window.addEventListener('message', handleEmbeddedSignupCallback);
  };

  const handleEmbeddedSignupCallback = async (event: MessageEvent) => {
    // Verificar origem da mensagem - aceitar tanto facebook.com quanto www.facebook.com
    if (!event.origin.includes('facebook.com')) {
      return;
    }

    const data = event.data;

    // Verificar se é uma mensagem do Embedded Signup
    // O Embedded Signup retorna dados no formato:
    // { type: 'embedded_signup_complete', code: string, waba_id: string, phone_number_id: string }
    if (data && data.type === 'embedded_signup_complete' && data.code) {
      setIsLoading(true);

      try {
        // Trocar código por token e configurar
        const response = await exchangeWhatsAppToken(instanceToken, {
          code: data.code,
          wabaId: data.waba_id,
          phoneNumberId: data.phone_number_id,
        });

        if (response.success) {
          await loadStatus();
          handleUpdate();
          alert('WhatsApp Official conectado com sucesso!');
        } else {
          alert(response.message || 'Erro ao conectar');
        }
      } catch (error) {
        console.error('Erro ao processar callback:', error);
        alert('Erro ao processar conexão');
      } finally {
        setIsLoading(false);
        window.removeEventListener('message', handleEmbeddedSignupCallback);
      }
    }
  };

  const handleConnect = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      alert('Facebook App ID não configurado');
      return;
    }

    setIsLoading(true);

    // Escutar mensagens do Embedded Signup antes de iniciar
    listenForEmbeddedSignupMessage();

    // Construir URL do Embedded Signup
    // A URL do Embedded Signup segue o padrão:
    // https://www.facebook.com/v23.0/dialog/oauth?
    //   client_id={app_id}&
    //   redirect_uri={redirect_uri}&
    //   scope=whatsapp_business_management,whatsapp_business_messaging&
    //   response_type=code&
    //   config_id={config_id}
    const redirectUri = `${window.location.origin}/instances`;
    const embeddedSignupUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code&config_id=${appId}`;

    // Abrir popup para Embedded Signup
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      embeddedSignupUrl,
      'WhatsAppEmbeddedSignup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    if (!popup) {
      alert('Por favor, permita popups para este site');
      setIsLoading(false);
      return;
    }

    // Verificar se o popup foi fechado
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setIsLoading(false);
        window.removeEventListener('message', handleEmbeddedSignupCallback);
      }
    }, 1000);
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Tem certeza que deseja desconectar a API oficial do WhatsApp? Isso não afetará a conexão Uazapi.',
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await disableWhatsAppOfficial(instanceToken);
      if (response.success) {
        await loadStatus();
        handleUpdate();
      } else {
        alert(response.message || 'Erro ao desconectar');
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      alert('Erro ao desconectar');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (status?.status === 'connected') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusText = () => {
    if (status?.status === 'connected') {
      return 'Conectado';
    }
    if (status?.status === 'connecting') {
      return 'Conectando...';
    }
    return 'Desconectado';
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      closeOnOverlayClick={true}
      contentClassName="max-w-lg"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <Typography variant="h3" className="text-xl font-semibold">
              Configuração WhatsApp Official
            </Typography>
            <Typography variant="p" className="text-sm text-gray-600">
              {instanceName}
            </Typography>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <Typography variant="p" className="text-sm text-gray-700 mb-2">
            <strong>Modo de Coexistência</strong>
          </Typography>
          <Typography variant="p" className="text-xs text-gray-600">
            Você pode usar a API oficial do WhatsApp (Meta) junto com a Uazapi
            no mesmo número. Ambas as APIs funcionarão simultaneamente.
          </Typography>
        </div>

        {isLoading && !status ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <Typography variant="p" className="font-medium">
                    Status: {getStatusText()}
                  </Typography>
                  {status?.phoneNumber && (
                    <Typography variant="p" className="text-xs text-gray-600">
                      Número: {status.phoneNumber}
                    </Typography>
                  )}
                </div>
              </div>
            </div>

            {/* Informações adicionais */}
            {status?.connectedAt && (
              <div className="text-xs text-gray-500">
                Conectado em:{' '}
                {new Date(status.connectedAt).toLocaleString('pt-BR')}
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-3 pt-4">
              {status?.status === 'connected' ? (
                <Button
                  variant="default"
                  bgHexColor="#ef4444"
                  className="flex-1"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={handleConnect}
                  disabled={isLoading}
                >
                  {isLoading ? 'Conectando...' : 'Conectar'}
                </Button>
              )}
              <Button
                variant="default"
                className="px-4"
                onClick={onClose}
                disabled={isLoading}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Informações sobre o processo */}
        {status?.status !== 'connected' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Typography variant="p" className="text-xs text-blue-800 mb-2">
              <strong>Como funciona:</strong>
            </Typography>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Você será redirecionado para o Facebook</li>
              <li>Faça login e autorize o acesso</li>
              <li>Selecione sua conta comercial do WhatsApp</li>
              <li>Escolha o número de telefone para conectar</li>
              <li>Será redirecionado de volta automaticamente</li>
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
