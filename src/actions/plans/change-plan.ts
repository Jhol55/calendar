'use server';

import Stripe from 'stripe';
import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';
import { changeSubscriptionPlan } from '@/services/stripe/stripe.service';
import { updateSessionWithPlanStatus } from '@/utils/security/session';
import { validatePlanDowngrade } from '@/services/subscription/subscription.service';

export async function changePlan(
  planId: number,
  billingPeriod: 'monthly' | 'yearly',
  applyImmediately: boolean = true,
): Promise<{
  success: boolean;
  message?: string;
  url?: string;
}> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    // Buscar subscription atual
    const currentSubscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        user: {
          select: { email: true },
        },
      },
    });

    if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
      return {
        success: false,
        message: 'Nenhuma assinatura ativa encontrada',
      };
    }

    // Verificar se o plano solicitado existe
    const newPlan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!newPlan || !newPlan.isActive) {
      return {
        success: false,
        message: 'Plano não encontrado ou inativo',
      };
    }

    // Não permitir trocar para o mesmo plano E mesma modalidade
    if (
      currentSubscription.planId === planId &&
      currentSubscription.billingPeriod === billingPeriod
    ) {
      return {
        success: false,
        message: 'Você já está neste plano com esta modalidade',
      };
    }

    // Validar se o uso atual excede os limites do novo plano (apenas para downgrades imediatos)
    if (applyImmediately) {
      const validation = await validatePlanDowngrade(userId, {
        maxStorageMB: newPlan.maxStorageMB,
        maxInstances: newPlan.maxInstances,
        name: newPlan.name,
      });

      if (!validation.allowed) {
        return {
          success: false,
          message: validation.errors.join(' '),
        };
      }
    }

    // Buscar price ID do Stripe
    const priceIdKey = `STRIPE_PRICE_${newPlan.slug.toUpperCase()}_${billingPeriod.toUpperCase()}`;
    const priceId = process.env[priceIdKey];

    if (!priceId || !priceId.startsWith('price_')) {
      return {
        success: false,
        message: 'Configuração de pagamento inválida',
      };
    }

    // Atualizar no Stripe
    const updatedStripeSubscription = await changeSubscriptionPlan(
      currentSubscription.stripeSubscriptionId,
      priceId,
      applyImmediately,
    );

    // Se aplicar imediatamente, verificar se há invoice pendente que precisa de pagamento
    let invoicePaymentUrl: string | null = null;
    if (applyImmediately && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Buscar a última invoice da subscription para mostrar detalhes de proration
        const invoices = await stripe.invoices.list({
          subscription: updatedStripeSubscription.id,
          limit: 1,
        });

        const latestInvoice = invoices.data[0];

        // Se há invoice pendente (open) que precisa de pagamento
        if (latestInvoice && latestInvoice.status === 'open') {
          if (latestInvoice.hosted_invoice_url) {
            invoicePaymentUrl = latestInvoice.hosted_invoice_url;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar invoices:', error);
        // Continua mesmo se houver erro na verificação
      }
    }

    // Atualizar no banco de dados
    if (applyImmediately) {
      // Função auxiliar para converter timestamp Unix para Date de forma segura
      const safeUnixToDate = (
        timestamp: number | null | undefined,
      ): Date | null => {
        if (
          timestamp &&
          typeof timestamp === 'number' &&
          !isNaN(timestamp) &&
          timestamp > 0
        ) {
          return new Date(timestamp * 1000);
        }
        return null;
      };

      // Converter períodos de Unix timestamp para Date de forma segura
      const currentPeriodStart = safeUnixToDate(
        updatedStripeSubscription.current_period_start,
      );
      const currentPeriodEnd = safeUnixToDate(
        updatedStripeSubscription.current_period_end,
      );

      // Se aplicar imediatamente, atualizar tudo agora
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: newPlan.id,
          billingPeriod,
          currentPeriodStart,
          currentPeriodEnd,
        },
      });

      // Atualizar plano do usuário imediatamente
      await prisma.user.update({
        where: { id: userId },
        data: { planId: newPlan.id },
      });
    } else {
      // Se aplicar no final do período:
      // - Não atualizar planId ainda (manter plano atual até o webhook confirmar)
      // - Apenas agendar a mudança no Stripe
      // - O webhook customer.subscription.updated vai atualizar quando o período mudar
      // Por enquanto, apenas marcar que há uma mudança agendada
      // (O Stripe já agendou, então não precisamos fazer nada no banco agora)
      console.log('📅 Troca de plano agendada para o final do período:', {
        currentPlanId: currentSubscription.planId,
        newPlanId: newPlan.id,
        currentPeriodEnd: currentSubscription.currentPeriodEnd,
      });

      // Não atualizamos planId ainda - será atualizado pelo webhook quando o período mudar
      // Mas podemos atualizar o billingPeriod se mudou (mas mantém o plano atual até então)
    }

    // Atualizar sessão
    if (currentSubscription.user?.email) {
      await updateSessionWithPlanStatus(
        currentSubscription.user.email,
        undefined,
        true,
      );
    }

    return {
      success: true,
      message: applyImmediately
        ? invoicePaymentUrl
          ? 'Redirecionando para pagamento...'
          : 'Plano alterado com sucesso! As mudanças já estão ativas.'
        : 'Troca de plano agendada! As mudanças serão aplicadas no final do período atual.',
      url: invoicePaymentUrl || undefined,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error changing plan:', err);
    return {
      success: false,
      message: 'Erro ao trocar de plano. Tente novamente.',
    };
  }
}
