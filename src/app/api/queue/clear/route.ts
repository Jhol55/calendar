import { NextResponse } from 'next/server';
import { webhookQueue } from '@/services/queue';

export async function POST() {
  try {
    console.log('🗑️  Clearing webhook queue...');

    const stats = {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    };

    // Limpar jobs em diferentes estados
    const waiting = await webhookQueue.clean(0, 'wait');
    stats.waiting = waiting.length;
    console.log(`✅ Removed ${waiting.length} waiting jobs`);

    const active = await webhookQueue.clean(0, 'active');
    stats.active = active.length;
    console.log(`✅ Removed ${active.length} active jobs`);

    const delayed = await webhookQueue.clean(0, 'delayed');
    stats.delayed = delayed.length;
    console.log(`✅ Removed ${delayed.length} delayed jobs`);

    const completed = await webhookQueue.clean(0, 'completed');
    stats.completed = completed.length;
    console.log(`✅ Removed ${completed.length} completed jobs`);

    const failed = await webhookQueue.clean(0, 'failed');
    stats.failed = failed.length;
    console.log(`✅ Removed ${failed.length} failed jobs`);

    // Esvaziar fila
    await webhookQueue.empty();
    console.log('🧹 Queue emptied');

    console.log('✨ Webhook queue cleared successfully!');

    return NextResponse.json({
      success: true,
      message: 'Queue cleared successfully',
      stats,
      total:
        stats.waiting +
        stats.active +
        stats.delayed +
        stats.completed +
        stats.failed,
    });
  } catch (error) {
    console.error('❌ Error clearing queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// GET para ver status da fila antes de limpar
export async function GET() {
  try {
    const waiting = await webhookQueue.getWaitingCount();
    const active = await webhookQueue.getActiveCount();
    const delayed = await webhookQueue.getDelayedCount();
    const completed = await webhookQueue.getCompletedCount();
    const failed = await webhookQueue.getFailedCount();

    return NextResponse.json({
      success: true,
      stats: {
        waiting,
        active,
        delayed,
        completed,
        failed,
        total: waiting + active + delayed + completed + failed,
      },
    });
  } catch (error) {
    console.error('❌ Error getting queue stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get queue stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
