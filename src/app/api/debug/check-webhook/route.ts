import { NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import { stripe } from '@/services/stripe/stripe.service';

/**
 * Rota de debug para verificar se há subscriptions no Stripe que não estão no banco
 */
export async function GET() {
  try {
    const session = await getSession();
    const sessionData = session as {
      user?: { email?: string };
    } | null;

    if (!sessionData?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionData.user.email },
      select: {
        id: true,
        email: true,
        planId: true,
        subscription: {
          select: {
            id: true,
            stripeSubscriptionId: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Buscar customer no Stripe
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    const customer = customers.data[0];

    if (!customer) {
      return NextResponse.json({
        message: 'No Stripe customer found',
        user: {
          id: user.id,
          email: user.email,
          planId: user.planId,
          subscription: user.subscription,
        },
      });
    }

    // Buscar subscriptions no Stripe
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        planId: user.planId,
        subscription: user.subscription,
      },
      stripe: {
        customerId: customer.id,
        subscriptionsCount: stripeSubscriptions.data.length,
        subscriptions: stripeSubscriptions.data.map((sub) => {
          const subWithPeriod = sub as typeof sub & {
            current_period_start: number;
            current_period_end: number;
          };
          return {
            id: sub.id,
            status: sub.status,
            currentPeriodStart: new Date(
              subWithPeriod.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(subWithPeriod.current_period_end * 1000),
          };
        }),
      },
      mismatch: {
        hasSubscriptionInDB: !!user.subscription,
        hasSubscriptionInStripe: stripeSubscriptions.data.length > 0,
        subscriptionIdMatches:
          user.subscription?.stripeSubscriptionId ===
          stripeSubscriptions.data[0]?.id,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { error: errorMessage, ...(errorStack && { stack: errorStack }) },
      { status: 500 },
    );
  }
}
