'use client';

import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import {
  connectInstance,
  deleteInstance,
  getInstanceStatus,
} from '@/actions/uazapi/instance';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { InstanceProps } from '@/contexts/user/user-context.type';
import { useUser } from '@/hooks/use-user';

interface InstanceStatusResponse {
  success: boolean;
  message?: string;
  code?: number;
  data?: {
    instance: {
      status: string;
      qrcode?: string;
      paircode?: string;
    };
  };
}

interface InstanceCardProps {
  instance: InstanceProps;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const [instanceStatus, setInstanceStatus] = useState<
    'disconnected' | 'connected' | 'connecting'
  >(
    (instance.status as 'disconnected' | 'connected' | 'connecting') ||
      'disconnected',
  );
  const [qrCode, setQrCode] = useState<string | ''>('');
  const [pairCode, setPairCode] = useState<string | ''>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const { handleUpdate } = useUser();
  // Este componente recebe a instância como prop, não precisa buscar todas
  // Removido uso de instances do contexto para evitar buscas desnecessárias

  const handleConnect = useCallback(async (token: string) => {
    const response = await connectInstance(token);
    if (response?.success) {
      setInstanceStatus('connecting');
    } else if (response?.code != 409) {
      setInstanceStatus('disconnected');
    }
  }, []);

  const handleDelete = useCallback(async (token: string) => {
    await deleteInstance(token);
  }, []);

  // Effect para gerenciar o polling quando status muda para connecting
  useEffect(() => {
    if (instanceStatus === 'connected') return;

    // Removida verificação de instances.find - não é mais necessária
    // A instância já é passada como prop

    console.log('aqui');

    let intervalId: NodeJS.Timeout | undefined = undefined;

    const fetchInstanceStatus = async () => {
      const response = (await getInstanceStatus(
        instance.token,
      )) as InstanceStatusResponse;

      console.log('response', response);

      if (
        response?.success &&
        response.data?.instance?.status === 'connected'
      ) {
        setInstanceStatus('connected');
        setShowQrModal(false);
        handleUpdate();
        if (intervalId) {
          clearInterval(intervalId);
        }
      } else {
        setInstanceStatus(
          (response.data?.instance?.status as
            | 'disconnected'
            | 'connected'
            | 'connecting') || 'disconnected',
        );
        const qrcode = response?.data?.instance?.qrcode;
        const paircode = response?.data?.instance?.paircode;

        setQrCode(qrcode || '');
        setPairCode(paircode || '');

        if (qrcode) {
          setShowQrModal(true);
        }
      }
    };

    // Primeira verificação imediata
    fetchInstanceStatus();

    // Polling a cada 5 segundos
    intervalId = setInterval(fetchInstanceStatus, 5000);

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [handleUpdate, instance.token, instanceStatus]);

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'connecting':
        return 'Conectando';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-red-500';
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white w-[18rem] rounded-lg shadow-md border border-gray-200 p-4 transition-shadow">
      <div className="relative flex items-center justify-between gap-2 mb-4">
        <Typography variant="h3" className="text-lg font-semibold truncate">
          {instance.name}
        </Typography>

        <div className="flex items-center gap-1 p-1">
          <div
            className={`w-2 h-2 rounded-full border ${getStatusColor(instanceStatus)}`}
          />
          <Typography
            variant="span"
            className={cn(
              'text-xs font-medium',
              instanceStatus === 'connected'
                ? '!text-green-600'
                : instanceStatus === 'disconnected'
                  ? '!text-red-600'
                  : '!text-yellow-600',
            )}
          >
            {getStatusText(instanceStatus)}
          </Typography>
        </div>
      </div>

      <div className="flex items-start gap-4 justify-between">
        {/* Profile Picture */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {instance.profilePicUrl ? (
              <Image
                src={instance.profilePicUrl}
                alt={instance.profileName || instance.name}
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-neutral-200 rounded-full flex items-center justify-center">
                <Typography
                  variant="span"
                  className="text-gray-600 text-lg font-semibold"
                >
                  {instance.name.charAt(0).toUpperCase()}
                </Typography>
              </div>
            )}
          </div>
          {/* Instance Info */}
          <div className="flex-1 min-w-0">
            {instance.profileName && (
              <Typography variant="p" className="text-sm text-gray-600 mb-1">
                {instance.profileName}
              </Typography>
            )}
            {instance.owner && (
              <Typography variant="p" className="text-sm text-gray-500 mb-1">
                {instance.owner}
              </Typography>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex mt-6 gap-2">
        <Button
          variant="default"
          bgHexColor={instanceStatus === 'connected' ? '#f59e0b' : '#30c18c'}
          className="text-xs px-3 py-1"
          onClick={
            instanceStatus === 'connected'
              ? () => handleConnect(instance.token)
              : () => handleConnect(instance.token)
          }
        >
          {instanceStatus === 'connected' ? 'Desconectar' : 'Conectar'}
        </Button>

        <Button
          variant="default"
          bgHexColor="#ff4646"
          className="text-xs px-3 py-1"
          onClick={async () => {
            await handleDelete(instance.token);
            handleUpdate();
          }}
        >
          Deletar
        </Button>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <Dialog
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          closeButton={true}
          closeOnOverlayClick={true}
        >
          <div className="flex flex-col items-center gap-4 p-6">
            <Typography
              variant="h3"
              className="text-lg font-semibold text-center"
            >
              Escaneie o QR Code com seu WhatsApp
            </Typography>

            {qrCode && (
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <Image
                  src={qrCode}
                  alt="QR Code para conectar WhatsApp"
                  width={256}
                  height={256}
                  className="rounded"
                />
              </div>
            )}

            {pairCode && (
              <div className="text-center">
                <Typography variant="p" className="text-sm text-gray-600 mb-2">
                  Ou use o código de pareamento:
                </Typography>
                <div className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg font-bold">
                  {pairCode}
                </div>
              </div>
            )}

            <Typography
              variant="p"
              className="text-sm text-gray-500 text-center"
            >
              O QR Code será atualizado automaticamente
            </Typography>
          </div>
        </Dialog>
      )}
    </div>
  );
}
