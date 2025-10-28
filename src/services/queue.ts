import Queue from 'bull';
import Redis from 'ioredis';

// Configuração de concurrency para processamento de webhooks
export const WEBHOOK_CONCURRENCY = parseInt(
  process.env.WEBHOOK_CONCURRENCY || '10',
);

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
};

// Cliente Redis
export const redis = new Redis(redisConfig);

// Configuração da fila
const queueConfig = {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Manter apenas 100 jobs completos
    removeOnFail: 50, // Manter apenas 50 jobs falhados
    attempts: 1, // ✅ SEM RETRY - executar apenas 1 vez
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // Delay inicial de 2 segundos
    },
  },
  settings: {
    lockDuration: 30000, // 30 segundos de lock
    lockRenewTime: 15000, // Renovar lock a cada 15 segundos
    stalledInterval: 0, // ✅ DESABILITAR verificação de jobs stalled
    maxStalledCount: 0, // ✅ Não recuperar jobs stalled
  },
};

// Fila principal de webhooks
export const webhookQueue = new Queue('webhook-processing', queueConfig);

// Fila para processamento de fluxos
export const flowQueue = new Queue('flow-processing', queueConfig);

// Fila para notificações
export const notificationQueue = new Queue('notifications', queueConfig);

// Tipos para os jobs
export interface WebhookJobData {
  webhookId: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: any;
  timestamp: string;
  flowId: string;
  nodeId: string;
  config: any;
  stopAtNodeId?: string; // Para execução parcial: parar neste node
}

export interface FlowJobData {
  executionId: string;
  flowId: string;
  triggerData: any;
  data: any;
}

export interface NotificationJobData {
  type: 'email' | 'webhook' | 'sms';
  recipient: string;
  message: string;
  data?: any;
}

// Eventos da fila de webhooks
webhookQueue.on('completed', (job, result) => {
  console.log(`✅ Webhook job ${job.id} completed:`, result);
});

webhookQueue.on('failed', (job, err) => {
  console.error(`❌ Webhook job ${job.id} failed:`, err.message);
});

webhookQueue.on('stalled', (job) => {
  console.warn(`⚠️ Webhook job ${job.id} stalled`);
});

// Eventos da fila de fluxos
flowQueue.on('completed', (job, result) => {
  console.log(`✅ Flow job ${job.id} completed:`, result);
});

flowQueue.on('failed', (job, err) => {
  console.error(`❌ Flow job ${job.id} failed:`, err.message);
});

// Eventos da fila de notificações
notificationQueue.on('completed', (job, result) => {
  console.log(`✅ Notification job ${job.id} completed:`, result);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job.id} failed:`, err.message);
});

// Função para adicionar job de webhook
export async function addWebhookJob(data: WebhookJobData, options?: any) {
  return await webhookQueue.add('process-webhook', data, {
    priority: 1, // Prioridade alta
    delay: 0, // Processar imediatamente
    ...options,
  });
}

// Função para adicionar job de fluxo
export async function addFlowJob(data: FlowJobData, options?: any) {
  return await flowQueue.add('process-flow', data, {
    priority: 2, // Prioridade média
    delay: 0,
    ...options,
  });
}

// Função para adicionar job de notificação
export async function addNotificationJob(
  data: NotificationJobData,
  options?: any,
) {
  return await notificationQueue.add('send-notification', data, {
    priority: 3, // Prioridade baixa
    delay: 0,
    ...options,
  });
}

// Função para obter estatísticas das filas
export async function getQueueStats() {
  const [webhookStats, flowStats, notificationStats] = await Promise.all([
    webhookQueue.getJobCounts(),
    flowQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
  ]);

  return {
    webhook: webhookStats,
    flow: flowStats,
    notification: notificationStats,
  };
}

// Função para limpar filas
export async function cleanQueues() {
  await Promise.all([
    webhookQueue.clean(24 * 60 * 60 * 1000, 'completed'), // Limpar jobs completos de 24h
    webhookQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // Limpar jobs falhados de 7 dias
    flowQueue.clean(24 * 60 * 60 * 1000, 'completed'),
    flowQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'),
    notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
    notificationQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'),
  ]);
}

// Função para pausar/retomar filas
export async function pauseQueue(queueName: string) {
  switch (queueName) {
    case 'webhook':
      await webhookQueue.pause();
      break;
    case 'flow':
      await flowQueue.pause();
      break;
    case 'notification':
      await notificationQueue.pause();
      break;
  }
}

export async function resumeQueue(queueName: string) {
  switch (queueName) {
    case 'webhook':
      await webhookQueue.resume();
      break;
    case 'flow':
      await flowQueue.resume();
      break;
    case 'notification':
      await notificationQueue.resume();
      break;
  }
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    webhookQueue.close(),
    flowQueue.close(),
    notificationQueue.close(),
  ]);
  await redis.quit();
}
