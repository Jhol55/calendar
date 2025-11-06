import { NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

/**
 * Rota de debug para forçar atualização do status de plano na sessão
 * Útil quando a subscription foi deletada mas a sessão ainda tem hasPlan: true
 */
export async function POST() {
  try {
    const session = await getSession();
    const sessionData = session as {
      user?: { email?: string };
    } | null;

    if (!sessionData?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = sessionData.user.email;

    // Buscar dados do banco
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        planId: true,
        subscription: {
          select: {
            id: true,
            status: true,
            trialEndsAt: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calcular hasPlan REAL do banco (mesma lógica do login)
    let hasPlanFromDB = false;
    if (user.subscription) {
      const now = new Date();
      const isTrialing =
        user.subscription.status === 'trialing' ||
        (user.subscription.trialEndsAt && user.subscription.trialEndsAt > now);
      hasPlanFromDB =
        user.subscription.status === 'active' ||
        isTrialing ||
        (user.subscription.status === 'past_due' &&
          !user.subscription.cancelAtPeriodEnd);
    }
    if (!hasPlanFromDB && user.planId !== null && user.planId !== undefined) {
      hasPlanFromDB = true;
    }

    // Atualizar sessão com o valor correto
    await updateSessionWithPlanStatus(
      email,
      sessionData.confirmed,
      hasPlanFromDB,
    );

    return NextResponse.json({
      success: true,
      message: 'Session updated',
      before: {
        hasPlan: (session as { hasPlan?: boolean })?.hasPlan,
      },
      after: {
        hasPlan: hasPlanFromDB,
      },
      database: {
        planId: user.planId,
        subscriptionExists: !!user.subscription,
        subscriptionStatus: user.subscription?.status,
        calculatedHasPlan: hasPlanFromDB,
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 },
    );
  }
}
