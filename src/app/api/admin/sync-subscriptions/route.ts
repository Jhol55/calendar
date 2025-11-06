import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import {
  syncAllSubscriptions,
  checkSyncStatus,
} from '@/services/stripe/sync.service';

/**
 * GET /api/admin/sync-subscriptions
 * Verificar status de sincronização
 */
export async function GET() {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implementar verificação de admin
    // Verificar se o usuário é admin (adicionar sua lógica de admin aqui)
    // const user = await prisma.user.findUnique({
    //   where: { id: userId },
    //   select: { email: true },
    // });

    // Por enquanto, permitir acesso apenas em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 },
      );
    }

    const status = await checkSyncStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error checking sync status:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/admin/sync-subscriptions
 * Executar sincronização completa
 */
export async function POST() {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implementar verificação de admin
    // Verificar se o usuário é admin (adicionar sua lógica de admin aqui)
    // const user = await prisma.user.findUnique({
    //   where: { id: userId },
    //   select: { email: true },
    // });

    // Por enquanto, permitir acesso apenas em desenvolvimento
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 },
      );
    }

    const result = await syncAllSubscriptions();

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors,
      details: result.details,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing subscriptions:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
