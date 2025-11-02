'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getPlans } from '@/actions/plans/get-plans';
import { getUserSubscription } from '@/actions/plans/get-user-subscription';
import { createCheckoutSession } from '@/actions/plans/create-checkout';
import { changePlan } from '@/actions/plans/change-plan';
import { Plan } from '@/types/subscription';
import { PLAN_FEATURES } from '@/config/plans.config';
import { PricingHeader } from '@/components/layout/pricing/pricing-header';
import { PricingCard } from '@/components/layout/pricing/pricing-card';
import { Loading } from '@/components/ui/loading';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';

const PAYMENT_FREQUENCIES = ['monthly', 'yearly'];

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [currentBillingPeriod, setCurrentBillingPeriod] = useState<
    string | null
  >(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null,
  );
  const [hasActivePaidPlan, setHasActivePaidPlan] = useState(false);
  // const [hasSubscription, setHasSubscription] = useState(false);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] = useState<{
    planId: number;
    planName: string;
    isDowngrade?: boolean;
  } | null>(null);
  const [selectedPaymentFreq, setSelectedPaymentFreq] = useState(
    PAYMENT_FREQUENCIES[0],
  );
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    loadPlans();
    loadCurrentSubscription();
  }, []);

  const loadPlans = async () => {
    try {
      const result = await getPlans();
      if (result.success && result.data) {
        setPlans(result.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const result = await getUserSubscription();
      if (result.success && result.data) {
        setCurrentPlanId(result.data.planId);
        setCurrentBillingPeriod(result.data.billingPeriod);
        setSubscriptionStatus(result.data.status);
        // setHasSubscription(true);
        // Verificar se tem plano pago ativo
        setHasActivePaidPlan(
          result.data.status === 'active' &&
            result.data.stripeSubscriptionId !== undefined,
        );
      } else {
        // Se não tem subscription, pode ser erro ou realmente não tem
        // setHasSubscription(false);
      }
    } catch (error) {
      console.error('Error loading current subscription:', error);
      // setHasSubscription(false);
    }
  };

  const handleSelectPlan = async (planId: number) => {
    const selectedPlanData = plans.find((p) => p.id === planId);

    // Se já tem plano pago ativo, verificar se é mudança de plano ou de modalidade
    if (hasActivePaidPlan) {
      const currentPlanData = plans.find((p) => p.id === currentPlanId);

      // Detectar se é mudança de plano ou apenas de modalidade (mensal/anual)
      const isChangingPlan = planId !== currentPlanId;
      const isChangingBillingPeriod =
        planId === currentPlanId &&
        selectedPaymentFreq !== currentBillingPeriod;

      // Se está mudando de modalidade (mensal ↔ anual), também precisa de confirmação
      if (isChangingPlan || isChangingBillingPeriod) {
        // Calcular preços baseados no período atual do usuário (não no selectedPaymentFreq)
        const currentPrice =
          currentBillingPeriod === 'yearly'
            ? currentPlanData?.priceYearly || 0
            : currentPlanData?.priceMonthly || 0;
        const newPrice =
          selectedPaymentFreq === 'yearly'
            ? selectedPlanData?.priceYearly || 0
            : selectedPlanData?.priceMonthly || 0;

        const isDowngrade = newPrice < currentPrice;

        setPendingPlanChange({
          planId,
          planName: selectedPlanData?.name || 'Plano',
          isDowngrade,
        });
        setShowChangePlanDialog(true);
        return;
      }
    }

    // Caso contrário, seguir com checkout normal
    await processPlanSelection(planId);
  };

  const processPlanSelection = async (planId: number) => {
    setSelectedPlan(planId);

    try {
      // Frontend apenas envia dados, toda validação no backend
      // O backend decide se é Trial ou plano pago baseado no banco de dados
      const result = await createCheckoutSession(
        planId,
        selectedPaymentFreq as 'monthly' | 'yearly',
      );

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        alert(result.message || 'Erro ao processar seleção de plano');
        setSelectedPlan(null);
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('Erro ao processar seleção de plano');
      setSelectedPlan(null);
    }
  };

  const handleChangePlan = async (applyImmediately: boolean) => {
    if (!pendingPlanChange) return;

    setChangingPlan(true);
    setShowChangePlanDialog(false);

    try {
      const result = await changePlan(
        pendingPlanChange.planId,
        selectedPaymentFreq as 'monthly' | 'yearly',
        applyImmediately,
      );

      if (result.success) {
        // Se há URL de pagamento, redirecionar
        if (result.url) {
          window.location.href = result.url;
        } else {
          // Redirecionar para billing após sucesso
          router.push('/billing');
        }
      } else {
        alert(result.message || 'Erro ao trocar de plano');
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      alert('Erro ao processar troca de plano');
    } finally {
      setChangingPlan(false);
      setPendingPlanChange(null);
    }
  };

  const getFeatures = (slug: string): readonly string[] => {
    const normalizedSlug = slug.toLowerCase() as
      | 'starter'
      | 'business'
      | 'enterprise'
      | 'trial';
    const features = PLAN_FEATURES[normalizedSlug] || [];

    return features;
  };

  const getAllFeatures = (plan: Plan): string[] => {
    const features = getFeatures(plan.slug);

    // Calcular texto de armazenamento
    const storageText =
      plan.maxStorageMB >= 1000
        ? `${(plan.maxStorageMB / 1000).toFixed(plan.maxStorageMB % 1000 === 0 ? 0 : 2)}GB de armazenamento`
        : `${plan.maxStorageMB}MB de armazenamento`;

    // Calcular texto de instâncias
    const instancesText =
      plan.maxInstances === -1
        ? 'Instâncias ilimitadas'
        : `${plan.maxInstances} instância${plan.maxInstances > 1 ? 's' : ''} WhatsApp`;

    // Adicionar armazenamento e instâncias no início da lista
    return [storageText, instancesText, ...(features as string[])];
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-neutral-50">
        <Loading size="md" variant="spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 pt-8 px-4 w-screen">
      <section
        className="mx-auto flex w-screen flex-col items-center gap-10"
        style={{ zoom: 0.9 }}
      >
        {/* Header */}
        <PricingHeader
          title="Escolha seu Plano"
          subtitle="Comece com 7 dias grátis. Cancele a qualquer momento."
          frequencies={PAYMENT_FREQUENCIES}
          selectedFrequency={selectedPaymentFreq}
          onFrequencyChange={setSelectedPaymentFreq}
          leftButton={
            <Button
              variant="ghost"
              onClick={() => router.push('/index')}
              className="whitespace-nowrap w-fit text-neutral-600"
            >
              <ChevronLeft className="w-8 h-8 text-neutral-600" />
              Voltar
            </Button>
          }
          // rightButton={
          //   hasSubscription ? (
          //     <Button
          //       variant="gradient"
          //       onClick={() => router.push('/billing')}
          //       className='whitespace-nowrap w-fit'
          //     >
          //       Gerenciar Assinatura
          //     </Button>
          //   ) : undefined
          // }
        />

        {/* Pricing Cards */}
        <div className="grid w-full max-w-7xl gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isPopular = plan.slug === 'business';
            // isTrial apenas para UI visual, lógica está no backend
            const isTrial = plan.slug === 'trial';
            const allFeatures = getAllFeatures(plan);

            // Desabilitar botão apenas se:
            // 1. O plano atual está ativo E
            // 2. Não está cancelado E
            // 3. Está no mesmo período de cobrança (mensal/anual) E
            // 4. Não é trial
            const isCurrentPlan = plan.id === currentPlanId;
            const isCurrentPeriod =
              selectedPaymentFreq === currentBillingPeriod;
            const disableButton =
              (isCurrentPlan &&
                subscriptionStatus !== 'canceled' &&
                isCurrentPeriod) ||
              isTrial;

            return (
              <PricingCard
                key={plan.id}
                plan={plan}
                paymentFrequency={selectedPaymentFreq}
                features={allFeatures}
                isPopular={isPopular}
                isTrial={isTrial}
                disabled={disableButton}
                onSelect={() => {
                  // Frontend apenas envia dados, backend valida tudo
                  handleSelectPlan(plan.id);
                }}
                isLoading={selectedPlan === plan.id}
              />
            );
          })}
        </div>
      </section>

      {/* Dialog de Troca de Plano */}
      <Dialog
        isOpen={showChangePlanDialog}
        onClose={() => !changingPlan && setShowChangePlanDialog(false)}
        closeButton={!changingPlan}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex-1">
            <Typography variant="h2" className="text-2xl font-bold mb-4">
              {pendingPlanChange?.isDowngrade
                ? 'Downgrade de Plano'
                : 'Trocar de Plano'}
            </Typography>

            {pendingPlanChange?.isDowngrade ? (
              <>
                <Typography variant="p" className="text-gray-600 mb-6">
                  Você está fazendo downgrade para o plano{' '}
                  <strong>{pendingPlanChange?.planName}</strong>. A mudança será
                  aplicada no final do período atual para garantir que você
                  aproveite todo o período já pago.
                </Typography>

                <div className="space-y-4">
                  <Button
                    variant="gradient"
                    onClick={() => handleChangePlan(false)}
                    disabled={changingPlan}
                    className="w-full"
                  >
                    {changingPlan ? 'Processando...' : 'Confirmar'}
                  </Button>

                  <Button
                    variant="default"
                    bgHexColor="#dc2626"
                    onClick={() => {
                      setShowChangePlanDialog(false);
                      setPendingPlanChange(null);
                    }}
                    disabled={changingPlan}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Typography variant="p" className="text-gray-600 mb-6">
                  Você está trocando para o plano{' '}
                  <strong>{pendingPlanChange?.planName}</strong>. Quando deseja
                  aplicar a mudança?
                </Typography>

                <div className="space-y-4">
                  <Button
                    variant="gradient"
                    onClick={() => handleChangePlan(true)}
                    disabled={changingPlan}
                    className="w-full"
                  >
                    {changingPlan ? 'Processando...' : 'Trocar Imediatamente'}
                  </Button>

                  <Button
                    variant="default"
                    bgHexColor="#f59e0b"
                    onClick={() => handleChangePlan(false)}
                    disabled={changingPlan}
                    className="w-full"
                  >
                    {changingPlan
                      ? 'Processando...'
                      : 'Aplicar no Final do Período'}
                  </Button>
                </div>

                <Typography variant="p" className="text-sm text-gray-500 mt-4">
                  • <strong>Imediatamente:</strong> Mudança aplicada agora, com
                  ajuste proporcional
                  <br />• <strong>Ao final do período:</strong> Mudança aplicada
                  na próxima renovação
                </Typography>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </main>
  );
}
