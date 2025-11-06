'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserSubscription } from '@/actions/plans/get-user-subscription';
import { cancelUserSubscription } from '@/actions/plans/cancel-subscription';
import { Subscription } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { Dialog } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress/progress';
import { Loader2, Calendar } from 'lucide-react';
import { Loading } from '@/components/ui/loading';

export default function BillingPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadSubscription();

    // Se veio da URL com ?success=true, pode ter webhook delay
    // Tentar recarregar após alguns segundos
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Primeira tentativa após 1 segundo
      const timeout1 = setTimeout(() => {
        loadSubscription();
      }, 1000);

      // Segunda tentativa após 3 segundos
      const timeout2 = setTimeout(() => {
        loadSubscription();
      }, 3000);

      // Terceira tentativa após 5 segundos
      const timeout3 = setTimeout(() => {
        loadSubscription();
      }, 5000);

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    }
  }, []);

  const loadSubscription = async () => {
    try {
      const result = await getUserSubscription();
      if (result.success && result.data) {
        // Debug: verificar inconsistências
        if (result.data.status === 'active' && result.data.trialEndsAt) {
          console.warn(
            '⚠️ Inconsistência detectada: Status é active mas tem trialEndsAt:',
            result.data,
          );
        }
        setSubscription(result.data);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (cancelAtPeriodEnd: boolean) => {
    setCanceling(true);

    try {
      const result = await cancelUserSubscription(cancelAtPeriodEnd);

      if (result.success) {
        setShowCancelDialog(false);
        // Recarregar subscription para atualizar status
        await loadSubscription();
        alert(result.message || 'Assinatura cancelada com sucesso');
      } else {
        alert(result.message || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Erro ao processar solicitação');
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'text-green-600';
      case 'past_due':
        return 'text-yellow-600';
      case 'canceled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'trialing':
        return 'Período de Trial';
      case 'past_due':
        return 'Pagamento Pendente';
      case 'canceled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-neutral-50">
        <Loading size="md" variant="spinner" />
      </div>
    );
  }

  if (!subscription) {
    const urlParams = new URLSearchParams(window.location.search);
    const isAfterCheckout = urlParams.get('success') === 'true';

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto" style={{ zoom: 0.9 }}>
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Typography variant="h1" className="text-3xl font-bold mb-4">
              {isAfterCheckout
                ? 'Processando sua Assinatura'
                : 'Nenhuma Assinatura Encontrada'}
            </Typography>
            <Typography variant="p" className="text-gray-600 mb-6">
              {isAfterCheckout
                ? 'Estamos processando sua assinatura. Por favor, aguarde alguns segundos...'
                : 'Você ainda não possui uma assinatura ativa.'}
            </Typography>
            {isAfterCheckout ? (
              <div className="flex items-center justify-center mb-6">
                <Loading size="md" variant="spinner" />
              </div>
            ) : (
              <Button variant="gradient" onClick={() => router.push('/plans')}>
                Ver Planos
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Considerar trial apenas se o status for 'trialing'
  // Se o status é 'active', não é trial, mesmo que tenha trialEndsAt
  const isTrialing =
    subscription.status === 'trialing' &&
    subscription.trialEndsAt &&
    new Date(subscription.trialEndsAt) > new Date();

  return (
    <main className="min-h-screen w-full bg-neutral-50 py-12 px-4">
      <div className="w-fit" style={{ zoom: 0.9 }}>
        <div className="mb-8">
          <Typography variant="h1" className="mb-2">
            Gerenciar Assinatura
          </Typography>
          <Typography variant="p" className="text-gray-600">
            Gerencie sua assinatura e faturamento
          </Typography>
        </div>

        {/* Card de Assinatura */}
        <div
          className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          style={{ zoom: 0.9 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <Typography variant="h2" className="text-xl font-bold mb-2">
                {subscription.plan?.name || 'Plano'}
              </Typography>
              <Typography
                variant="span"
                className={`font-semibold ${getStatusColor(subscription.status)}`}
              >
                {getStatusLabel(subscription.status)}
              </Typography>
            </div>

            <div className="text-right">
              <Typography variant="p" className="text-sm text-gray-600">
                {subscription.billingPeriod === 'monthly' ? 'Mensal' : 'Anual'}
              </Typography>
              {subscription.plan && (
                <Typography variant="h3" className="text-xl font-bold">
                  R${' '}
                  {subscription.billingPeriod === 'monthly'
                    ? subscription.plan.priceMonthly.toFixed(2)
                    : subscription.plan.priceYearly.toFixed(2)}
                </Typography>
              )}
            </div>
          </div>

          {isTrialing && subscription.trialEndsAt && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
              <Typography variant="p">
                ⏰ Seu trial termina em {formatDate(subscription.trialEndsAt)}
              </Typography>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <Typography variant="p" className="text-yellow-800">
                ⚠️ Sua assinatura será cancelada em{' '}
                {subscription.currentPeriodEnd &&
                  formatDate(subscription.currentPeriodEnd)}
              </Typography>
            </div>
          )}

          <div className="flex items-start gap-2 my-4">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <Typography variant="p" className="text-sm text-gray-600">
                Período Atual
              </Typography>
              <Typography variant="p" className="text-sm font-semibold">
                {subscription.currentPeriodStart &&
                subscription.currentPeriodEnd
                  ? `${formatDate(subscription.currentPeriodStart)} - ${formatDate(subscription.currentPeriodEnd)}`
                  : 'Período não disponível'}
              </Typography>
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-6 mb-6">
            {subscription.plan && (
              <div className="space-y-5">
                <Typography
                  variant="p"
                  className="text-sm text-gray-600 font-semibold"
                >
                  Limites do Plano
                </Typography>

                {/* Barra de progresso - Armazenamento */}
                <Progress
                  current={subscription.currentUsage?.storageMB || 0}
                  max={subscription.plan.maxStorageMB}
                  label="Armazenamento"
                  formatValue={(value) => {
                    if (value >= 1000) {
                      const gb = value / 1000;
                      return `${gb.toFixed(2)}GB`;
                    }
                    // Sempre mostrar 2 casas decimais para MB (ex: 0.57MB, 1.02MB)
                    return `${value.toFixed(2)}MB`;
                  }}
                />

                {/* Barra de progresso - Instâncias */}
                <Progress
                  current={subscription.currentUsage?.instances || 0}
                  max={subscription.plan.maxInstances}
                  label="Instâncias WhatsApp"
                  formatValue={(value) => `${value}`}
                />
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            {subscription.status !== 'canceled' && (
              <Button
                variant="gradient"
                className="w-full sm:w-auto"
                onClick={() => router.push('/plans')}
              >
                Trocar de Plano
              </Button>
            )}

            {subscription.status !== 'canceled' &&
              !subscription.cancelAtPeriodEnd && (
                <Button
                  variant="gradient"
                  darkenFactor={0.1}
                  bgHexColor="#df3737"
                  className="w-full sm:w-auto"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={canceling}
                >
                  {canceling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Cancelar Assinatura'
                  )}
                </Button>
              )}

            {subscription.status === 'canceled' && (
              <Button
                variant="gradient"
                className="w-full sm:w-auto"
                onClick={() => router.push('/plans')}
              >
                Assinar Novo Plano
              </Button>
            )}
          </div>
        </div>

        <Button variant="ghost" onClick={() => router.push('/index')}>
          Voltar para o dashboard
        </Button>
      </div>

      {/* Dialog de Cancelamento */}
      <Dialog
        isOpen={showCancelDialog}
        onClose={() => !canceling && setShowCancelDialog(false)}
        closeButton={!canceling}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex-1">
            <Typography variant="h2" className="text-2xl font-bold mb-4">
              Cancelar Assinatura
            </Typography>

            <Typography variant="p" className="text-gray-600 mb-6">
              Como deseja cancelar sua assinatura?
            </Typography>

            <div className="space-y-4">
              <Button
                variant="default"
                bgHexColor="#dc2626"
                onClick={() => handleCancelSubscription(false)}
                disabled={canceling}
                className="w-full"
              >
                {canceling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Cancelar Imediatamente'
                )}
              </Button>

              <Button
                variant="default"
                bgHexColor="#f59e0b"
                onClick={() => handleCancelSubscription(true)}
                disabled={canceling}
                className="w-full"
              >
                {canceling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Cancelar ao Final do Período'
                )}
              </Button>
            </div>

            <Typography variant="p" className="text-sm text-gray-500 mt-4">
              • <strong>Imediatamente:</strong> Perde acesso agora
              <br />• <strong>Ao final do período:</strong> Mantém acesso até{' '}
              {subscription.currentPeriodEnd &&
                formatDate(subscription.currentPeriodEnd)}
            </Typography>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
