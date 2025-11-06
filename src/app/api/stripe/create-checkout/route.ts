import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import {
  createOrGetCustomer,
  createCheckoutSession,
} from '@/services/stripe/stripe.service';

export async function POST(request: NextRequest) {
  let userId: number | null = null;

  try {
    // Autenticação: Validar sessão
    const authSession = await getSession();
    const sessionUser = authSession as { user?: { email?: string } } | null;

    if (!sessionUser?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar usuário no banco (validação de segurança)
    const user = await prisma.user.findUnique({
      where: { email: sessionUser.user.email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    userId = user.id;

    const body = await request.json();
    const { planId, billingPeriod } = body;

    // Validações básicas
    if (!planId || planId === null || planId === undefined) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 },
      );
    }

    const planIdNumber = parseInt(String(planId), 10);
    if (isNaN(planIdNumber) || planIdNumber <= 0) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    // Buscar plano do banco (única fonte de verdade)
    const plan = await prisma.plan.findUnique({
      where: { id: planIdNumber },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { error: 'Plan is not active' },
        { status: 400 },
      );
    }

    // Validação segura: Verificar se é plano grátis (Trial ou preço zero)
    // Toda lógica de negócio no backend - baseada no banco de dados
    const isFreePlan =
      plan.slug === 'trial' ||
      Number(plan.priceMonthly) === 0 ||
      Number(plan.priceYearly) === 0;

    // Se for plano grátis, billingPeriod é opcional (padrão mensal)
    const finalBillingPeriod = isFreePlan
      ? billingPeriod || 'monthly'
      : billingPeriod;

    if (!isFreePlan) {
      // Para planos pagos, billingPeriod é obrigatório e validado
      if (!billingPeriod) {
        return NextResponse.json(
          { error: 'billingPeriod is required for paid plans' },
          { status: 400 },
        );
      }

      if (billingPeriod !== 'monthly' && billingPeriod !== 'yearly') {
        return NextResponse.json(
          { error: 'billingPeriod must be "monthly" or "yearly"' },
          { status: 400 },
        );
      }
    }

    // Processar plano grátis (Trial) - SEM Stripe
    if (isFreePlan) {
      // Validação de segurança: Verificar se usuário já tem subscription ativa
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      // Se já tem subscription ativa, não permitir criar outra
      if (existingSubscription) {
        const isActive =
          existingSubscription.status === 'active' ||
          existingSubscription.status === 'trialing';
        if (isActive) {
          return NextResponse.json(
            { error: 'You already have an active subscription' },
            { status: 400 },
          );
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

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
        request.nextUrl.origin;

      return NextResponse.json({
        success: true,
        url: `${baseUrl}/billing?success=true`,
      });
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
      return NextResponse.json(
        {
          error: 'Payment configuration error. Please contact support.',
        },
        { status: 500 },
      );
    }

    // Validar que o priceId tem formato correto
    if (!priceId.startsWith('price_')) {
      console.error(`Invalid Stripe Price ID format: ${priceId}`);
      return NextResponse.json(
        {
          error: 'Invalid payment configuration. Please contact support.',
        },
        { status: 500 },
      );
    }

    // Para planos pagos: verificar se usuário está em trial
    // Se estiver, marcar como hasUsedTrial = true para não dar trial no plano pago
    const hasUsedTrial =
      existingSubscriptionPaid?.status === 'trialing' || false;

    // Criar ou buscar customer no Stripe (apenas para planos pagos)
    const customer = await createOrGetCustomer({
      email: user.email,
      name: user.name || undefined,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
      request.nextUrl.origin;

    // Criar sessão de checkout (sem trial se já usou antes)
    const session = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      userId,
      planId: plan.id,
      successUrl: `${baseUrl}/billing?success=true`,
      cancelUrl: `${baseUrl}/plans?canceled=true`,
      hasUsedTrial,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    // Log detalhado apenas no servidor (não expor ao cliente)
    console.error('Error creating checkout session:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: userId || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Retornar mensagem genérica para o cliente (segurança)
    // Não expor detalhes técnicos que possam ajudar em ataques
    return NextResponse.json(
      {
        error:
          'Failed to create checkout session. Please try again or contact support.',
      },
      { status: 500 },
    );
  }
}
