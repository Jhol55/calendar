import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import { createPortalSession } from '@/services/stripe/stripe.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const sessionUser = session as { user?: { email?: string } } | null;

    if (!sessionUser?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionUser.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user.id;

    // Buscar subscription do usuário
    const subscription = await prisma.subscription.findUnique({
      where: { userId: userId },
      select: { stripeCustomerId: true },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
      request.nextUrl.origin;

    // Criar sessão do portal
    const portalSession = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${baseUrl}/billing`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
