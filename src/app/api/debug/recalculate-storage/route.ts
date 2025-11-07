import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { getStorageUsage } from '@/services/subscription/subscription.service';

/**
 * Rota de debug para forçar recálculo completo do armazenamento
 * Útil quando há discrepância entre valores incrementais e reais
 */
export async function POST() {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forçar recálculo completo (ignorar cache)
    const storageMB = await getStorageUsage(userId);

    return NextResponse.json({
      success: true,
      storageMB,
      message: `Armazenamento recalculado: ${storageMB}MB`,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to recalculate storage';
    console.error('Error recalculating storage:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
