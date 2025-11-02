'use client';
import { useEffect, useState } from 'react';
import { InstanceCard } from '@/components/layout/instance-card/instance-card';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { CreateInstanceForm } from '@/components/features/forms/create-instance/create-instance';
import { Dialog } from '@/components/ui/dialog';
import { Loading } from '@/components/ui/loading';
import { useUser } from '@/hooks/use-user';
import { useInstances } from '@/lib/react-query/hooks/use-user';

export default function Instances() {
  const [loading, setLoading] = useState(true);
  const [showCreateInstanceForm, setShowCreateInstanceForm] = useState(false);

  const { handleUpdate } = useUser();
  // Buscar instâncias diretamente nesta página
  const { data: instances = [], isLoading: instancesLoading } = useInstances({
    enabled: true, // Habilitar busca nesta página
  });

  useEffect(() => {
    // Atualizar loading baseado no estado da query
    setLoading(instancesLoading);
  }, [instancesLoading]);

  return (
    <main className="relative flex w-screen h-screen overflow-hidden p-6 md:p-10 bg-gradient-to-br from-neutral-50 via-white to-blue-50 text-neutral-800">
      <div className="w-full max-w-7xl" style={{ zoom: 0.9 }}>
        <div className="flex items-center gap-10 mb-8">
          <div>
            <Typography
              variant="h1"
              className="text-3xl font-bold text-neutral-900 mb-3"
            >
              Minhas Instâncias
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Gerencie suas instâncias do WhatsApp
            </Typography>
          </div>
          <div>
            <Button
              variant="gradient"
              className="w-fit h-fit"
              onClick={() => setShowCreateInstanceForm(true)}
            >
              + Instância
            </Button>
          </div>
        </div>

        {instances.length === 0 && !loading ? (
          <div className="text-center py-16">
            <div className="bg-white/80 backdrop-blur border border-neutral-200 shadow-xl rounded-3xl p-8 max-w-md mx-auto">
              <Typography variant="p" className="text-neutral-600 mb-4 text-lg">
                Nenhuma instância encontrada
              </Typography>
              <Typography variant="p" className="text-neutral-500 mb-4">
                Crie uma nova instância para começar
              </Typography>
              <Button
                variant="gradient"
                className="w-fit"
                onClick={() => setShowCreateInstanceForm(true)}
              >
                + Instância
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-96">
            <Loading text="" size="md" variant="spinner" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criação de Instância */}
      {showCreateInstanceForm && (
        <Dialog
          isOpen={showCreateInstanceForm}
          onClose={() => setShowCreateInstanceForm(false)}
          closeButton={true}
          closeOnOverlayClick={true}
        >
          <CreateInstanceForm
            onSuccess={() => {
              setShowCreateInstanceForm(false);
              setLoading(true);
              handleUpdate();
              const timeout = setTimeout(() => {
                setLoading(false);
              }, 3000);
              return () => clearTimeout(timeout);
            }}
          />
        </Dialog>
      )}
    </main>
  );
}
