import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { getStorageUsage } from '@/services/subscription/subscription.service';

/**
 * Rota de debug para forçar recálculo completo do armazenamento
 * Útil quando há discrepância entre valores incrementais e reais
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forçar recálculo completo (ignorar cache)
    const storageMB = await getStorageUsage(userId, true);

    return NextResponse.json({
      success: true,
      storageMB,
      message: `Armazenamento recalculado: ${storageMB}MB`,
    });
  } catch (error: any) {
    console.error('Error recalculating storage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate storage' },
      { status: 500 },
    );
  }
}
