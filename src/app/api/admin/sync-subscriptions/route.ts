import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { prisma } from '@/services/prisma';
import {
  syncAllSubscriptions,
  checkSyncStatus,
} from '@/services/stripe/sync.service';

/**
 * GET /api/admin/sync-subscriptions
 * Verificar status de sincronização
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se o usuário é admin (adicionar sua lógica de admin aqui)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // TODO: Implementar verificação de admin
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
  } catch (error: any) {
    console.error('Error checking sync status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/sync-subscriptions
 * Executar sincronização completa
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se o usuário é admin (adicionar sua lógica de admin aqui)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // TODO: Implementar verificação de admin
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
  } catch (error: any) {
    console.error('Error syncing subscriptions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
