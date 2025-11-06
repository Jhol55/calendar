import { NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';

/**
 * Rota de debug para verificar estado da sessão e plano no banco
 */
export async function GET() {
  try {
    const session = await getSession();
    const sessionData = session as {
      user?: { email?: string };
      confirmed?: boolean;
      hasPlan?: boolean;
    } | null;

    if (!sessionData?.user?.email) {
      return NextResponse.json({
        session: null,
        message: 'No session found',
      });
    }

    // Buscar dados do banco para comparar
    const user = await prisma.user.findUnique({
      where: { email: sessionData.user.email },
      select: {
        id: true,
        email: true,
        confirmed: true,
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

    // Calcular hasPlan do banco (mesma lógica do login)
    let hasPlanFromDB = false;
    if (user?.subscription) {
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
    if (!hasPlanFromDB && user?.planId !== null && user?.planId !== undefined) {
      hasPlanFromDB = true;
    }

    return NextResponse.json({
      session: {
        email: sessionData.user.email,
        confirmed: sessionData.confirmed,
        hasPlan: sessionData.hasPlan,
      },
      database: {
        userId: user?.id,
        confirmed: user?.confirmed,
        planId: user?.planId,
        subscriptionExists: !!user?.subscription,
        subscriptionStatus: user?.subscription?.status,
        subscriptionCancelAtPeriodEnd: user?.subscription?.cancelAtPeriodEnd,
        subscriptionTrialEndsAt: user?.subscription?.trialEndsAt,
        hasPlanFromDB,
      },
      calculation: {
        hasSubscription: !!user?.subscription,
        subscriptionIsActive: user?.subscription?.status === 'active',
        subscriptionIsTrialing: user?.subscription?.status === 'trialing',
        hasPlanId: user?.planId !== null && user?.planId !== undefined,
      },
      mismatch: {
        confirmed: sessionData.confirmed !== user?.confirmed,
        hasPlan: sessionData.hasPlan !== hasPlanFromDB,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to get session';
    console.error('Error getting session:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
