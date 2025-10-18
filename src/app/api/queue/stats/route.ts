import { NextResponse } from 'next/server';
import {
  getQueueStats,
  webhookQueue,
  flowQueue,
  notificationQueue,
} from '@/services/queue';

export async function GET() {
  try {
    const stats = await getQueueStats();

    // Obter jobs ativos
    const [webhookActive, flowActive, notificationActive] = await Promise.all([
      webhookQueue.getActive(),
      flowQueue.getActive(),
      notificationQueue.getActive(),
    ]);

    // Obter jobs falhados recentes
    const [webhookFailed, flowFailed, notificationFailed] = await Promise.all([
      webhookQueue.getFailed(),
      flowQueue.getFailed(),
      notificationQueue.getFailed(),
    ]);

    return NextResponse.json({
      status: 'success',
      data: {
        queues: {
          webhook: {
            ...stats.webhook,
            active: webhookActive.length,
            failed: webhookFailed.length,
            activeJobs: webhookActive.map((job) => ({
              id: job.id,
              data: job.data,
              progress: job.progress(),
              processedOn: job.processedOn,
              attemptsMade: job.attemptsMade,
            })),
          },
          flow: {
            ...stats.flow,
            active: flowActive.length,
            failed: flowFailed.length,
            activeJobs: flowActive.map((job) => ({
              id: job.id,
              data: job.data,
              progress: job.progress(),
              processedOn: job.processedOn,
              attemptsMade: job.attemptsMade,
            })),
          },
          notification: {
            ...stats.notification,
            active: notificationActive.length,
            failed: notificationFailed.length,
            activeJobs: notificationActive.map((job) => ({
              id: job.id,
              data: job.data,
              progress: job.progress(),
              processedOn: job.processedOn,
              attemptsMade: job.attemptsMade,
            })),
          },
        },
        summary: {
          totalWaiting:
            stats.webhook.waiting +
            stats.flow.waiting +
            stats.notification.waiting,
          totalActive:
            webhookActive.length +
            flowActive.length +
            notificationActive.length,
          totalCompleted:
            stats.webhook.completed +
            stats.flow.completed +
            stats.notification.completed,
          totalFailed:
            stats.webhook.failed +
            stats.flow.failed +
            stats.notification.failed,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get queue statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
