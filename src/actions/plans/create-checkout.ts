'use server';

import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';
import {
  createOrGetCustomer,
  createCheckoutSession as createStripeCheckoutSession,
} from '@/services/stripe/stripe.service';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

export async function createCheckoutSession(
  planId: number,
  billingPeriod: 'monthly' | 'yearly',
): Promise<{
  success: boolean;
  sessionId?: string;
  url?: string;
  message?: string;
}> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Validações básicas
    const planIdNumber = parseInt(String(planId), 10);
    if (isNaN(planIdNumber) || planIdNumber <= 0) {
      return {
        success: false,
        message: 'Invalid planId',
      };
    }

    // Buscar plano do banco (única fonte de verdade)
    const plan = await prisma.plan.findUnique({
      where: { id: planIdNumber },
    });

    if (!plan) {
      return {
        success: false,
        message: 'Plan not found',
      };
    }

    if (!plan.isActive) {
      return {
        success: false,
        message: 'Plan is not active',
      };
    }

    // Validação segura: Verificar se é plano grátis (Trial ou preço zero)
    const isFreePlan =
      plan.slug === 'trial' ||
      Number(plan.priceMonthly) === 0 ||
      Number(plan.priceYearly) === 0;

    // Se for plano grátis, billingPeriod é opcional (padrão mensal)
    const finalBillingPeriod = isFreePlan
      ? billingPeriod || 'monthly'
      : billingPeriod;

    if (!isFreePlan) {
      // Para planos pagos, billingPeriod é obrigatório
      if (!billingPeriod) {
        return {
          success: false,
          message: 'billingPeriod is required for paid plans',
        };
      }

      if (billingPeriod !== 'monthly' && billingPeriod !== 'yearly') {
        return {
          success: false,
          message: 'billingPeriod must be "monthly" or "yearly"',
        };
      }
    }

    // Processar plano grátis (Trial) - SEM Stripe
    if (isFreePlan) {
      // Validação de segurança: Verificar se usuário já tem subscription ativa
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (existingSubscription) {
        const isActive =
          existingSubscription.status === 'active' ||
          existingSubscription.status === 'trialing';
        if (isActive) {
          return {
            success: false,
            message: 'You already have an active subscription',
          };
        }
      }

      // Criar assinatura grátis diretamente no banco (sem Stripe)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 dias de trial

      // Calcular uso atual ANTES da transação para preservar dados existentes
      const { getStorageUsage, getInstanceCount } = await import(
        '@/services/subscription/subscription.service'
      );

      const currentStorageMB = await getStorageUsage(userId);
      const currentInstances = await getInstanceCount(userId);

      await prisma.$transaction(async (tx) => {
        // Criar ou atualizar assinatura
        await tx.subscription.upsert({
          where: { userId },
          create: {
            userId,
            planId: plan.id,
            status: 'trialing',
            billingPeriod: finalBillingPeriod as 'monthly' | 'yearly',
            trialEndsAt: trialEndDate,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
          },
          update: {
            planId: plan.id,
            status: 'trialing',
            billingPeriod: finalBillingPeriod as 'monthly' | 'yearly',
            trialEndsAt: trialEndDate,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
            canceledAt: null,
            cancelAtPeriodEnd: false,
          },
        });

        // Atualizar plano do usuário
        await tx.user.update({
          where: { id: userId },
          data: { planId: plan.id },
        });

        // Criar ou atualizar limites com valores reais calculados (não zerar!)
        await tx.user_plan_limits.upsert({
          where: { userId },
          create: {
            userId,
            currentStorageMB,
            currentInstances,
          },
          update: {
            currentStorageMB,
            currentInstances,
          },
        });
      });

      // Atualizar sessão com hasPlan: true
      await updateSessionWithPlanStatus(user.email, undefined, true);

      // Construir URL de redirecionamento (para Server Actions)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      return {
        success: true,
        url: `${baseUrl}/billing?success=true`,
      };
    }

    // Para planos pagos: Validações de segurança antes do Stripe
    // Verificar se usuário já tem subscription ativa
    const existingSubscriptionPaid = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Permitir troca de plano mesmo com subscription ativa
    // A lógica de upgrade/downgrade será tratada no frontend com dialog
    if (existingSubscriptionPaid) {
      if (existingSubscriptionPaid.status === 'trialing') {
        console.log(
          'ℹ️ User has trial subscription, allowing upgrade to paid plan',
        );
      } else if (existingSubscriptionPaid.status === 'active') {
        // Se já tem plano pago e está tentando outro plano pago,
        // deve usar a função de troca de plano (change-plan.ts), não checkout
        // Mas por enquanto permitimos, pois o frontend vai tratar
        console.log(
          'ℹ️ User has active subscription, will use change plan flow',
        );
      }
    }

    // Buscar price ID do Stripe (validação no backend)
    const priceIdKey = `STRIPE_PRICE_${plan.slug.toUpperCase()}_${billingPeriod.toUpperCase()}`;
    const priceId = process.env[priceIdKey];

    if (!priceId || priceId.trim() === '') {
      console.error(`Missing Stripe Price ID for: ${priceIdKey}`);
      return {
        success: false,
        message: 'Payment configuration error. Please contact support.',
      };
    }

    // Validar que o priceId tem formato correto
    if (!priceId.startsWith('price_')) {
      console.error(`Invalid Stripe Price ID format: ${priceId}`);
      return {
        success: false,
        message: 'Invalid payment configuration. Please contact support.',
      };
    }

    // Para planos pagos: SEMPRE sem trial no checkout
    // - Se estiver em trial: não acumular trial no plano pago
    // - Se não estiver: já existe card Trial separado para isso
    const hasUsedTrial = true;

    // Criar ou buscar customer no Stripe
    const customer = await createOrGetCustomer({
      email: user.email,
      name: user.name || undefined,
    });

    // Construir URL de redirecionamento
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Criar sessão de checkout (sempre sem trial para planos pagos)
    const session = await createStripeCheckoutSession({
      customerId: customer.id,
      priceId,
      userId,
      planId: plan.id,
      successUrl: `${baseUrl}/billing?success=true`,
      cancelUrl: `${baseUrl}/plans?canceled=true`,
      hasUsedTrial,
    });

    return {
      success: true,
      sessionId: session.id,
      url: session.url,
    };
  } catch (error: any) {
    // Log detalhado no servidor para debugging (não expor ao cliente)
    console.error('Error creating checkout session:', {
      userId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Retornar mensagem genérica ao cliente (segurança)
    return {
      success: false,
      message:
        'Failed to create checkout session. Please try again or contact support.',
    };
  }
}
