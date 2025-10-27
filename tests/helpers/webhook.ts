// ============================================
// HELPER FUNCTIONS PARA TESTES DE WEBHOOK NODE
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { webhookQueue, WebhookJobData } from '@/services/queue';
import type { Job } from 'bull';

/**
 * Tipos e Interfaces
 */
export interface WebhookTestResult {
  jobId: string;
  executionId: string;
  jobResult: any;
  duration: number;
}

export interface TriggerOptions {
  timeout?: number;
  throwOnError?: boolean;
  method?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

// Re-export node factory from nodes.ts
export { createWebhookNode } from './nodes';

/**
 * Adiciona um job de webhook na fila
 */
export async function addWebhookJob(
  flowId: string,
  webhookId: string,
  payload: any = {},
  options: Partial<TriggerOptions> = {},
): Promise<Job<WebhookJobData>> {
  const jobData: WebhookJobData = {
    webhookId,
    flowId,
    nodeId: webhookId,
    method: options.method || 'POST',
    headers: options.headers || {},
    queryParams: options.queryParams || {},
    body: payload,
    timestamp: new Date().toISOString(),
    config: {},
  };

  return await webhookQueue.add('process-webhook', jobData, {
    removeOnComplete: false, // Manter para testes
    removeOnFail: false, // Manter para testes
  });
}

/**
 * Aguarda a conclusão de um job específico
 */
export async function waitForJobCompletion(
  jobId: string,
  timeout: number = 10000,
  throwOnError: boolean = true,
): Promise<any> {
  const job = await webhookQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  // Verificar estado atual primeiro (pode já estar completo)
  const currentState = await job.getState();
  if (currentState === 'completed') {
    const result = await job.finished();
    // Verificar se o resultado indica erro
    if (result && result.error === true && throwOnError) {
      throw new Error(`Job failed: ${result.message || 'Unknown error'}`);
    }
    return result;
  }
  if (currentState === 'failed') {
    const failedReason = job.failedReason;
    throw new Error(`Job failed: ${failedReason}`);
  }

  // Usar Promise.race entre o job.finished() e o timeout
  const result = await Promise.race([
    job.finished(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Job ${jobId} timeout after ${timeout}ms`)),
        timeout,
      ),
    ),
  ]);

  // Verificar se o resultado indica erro
  if (result && result.error === true && throwOnError) {
    throw new Error(`Job failed: ${result.message || 'Unknown error'}`);
  }

  return result;
}

/**
 * Dispara um webhook e aguarda sua conclusão
 * Função principal para testes de webhook
 */
export async function triggerAndWait(
  flowId: string,
  webhookId: string,
  payload: any = {},
  optionsOrTimeout?: Partial<TriggerOptions> | number,
  legacyThrowOnError?: boolean,
): Promise<WebhookTestResult> {
  const startTime = Date.now();

  // Suporte para assinatura antiga e nova
  let options: Partial<TriggerOptions>;
  if (typeof optionsOrTimeout === 'number') {
    // Assinatura antiga: triggerAndWait(flowId, webhookId, payload, timeout, throwOnError)
    options = {
      timeout: optionsOrTimeout,
      throwOnError:
        legacyThrowOnError !== undefined ? legacyThrowOnError : true,
    };
  } else {
    // Nova assinatura: triggerAndWait(flowId, webhookId, payload, options)
    options = optionsOrTimeout || {};
  }

  const timeout = options.timeout || 10000;
  const throwOnError =
    options.throwOnError !== undefined ? options.throwOnError : true;

  // Adicionar job na fila
  const job = await addWebhookJob(flowId, webhookId, payload, options);

  // Aguardar conclusão
  const jobResult = await waitForJobCompletion(
    job.id.toString(),
    timeout,
    throwOnError,
  );

  const duration = Date.now() - startTime;

  // Tentar obter executionId do resultado ou procurar na DB
  let executionId = jobResult?.executionId;

  // Se não tiver executionId no resultado mas o job foi processado, buscar da DB
  if (!executionId && jobResult) {
    try {
      const { prisma } = await import('@/services/prisma');
      const execution = await prisma.flow_executions.findFirst({
        where: { flowId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (execution) {
        executionId = execution.id;
      }
    } catch {
      // Ignorar erro ao buscar da DB
    }
  }

  return {
    jobId: job.id.toString(),
    executionId,
    jobResult,
    duration,
  };
}

/**
 * Obtém o resultado de um job
 */
export async function getJobResult(jobId: string): Promise<any> {
  const job = await webhookQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  const state = await job.getState();
  if (state === 'completed') {
    return await job.finished();
  }
  if (state === 'failed') {
    throw new Error(`Job failed: ${job.failedReason}`);
  }

  return null;
}

/**
 * Obtém o estado atual de um job
 */
export async function getJobState(jobId: string): Promise<string> {
  const job = await webhookQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }
  return await job.getState();
}

/**
 * Resultado da validação de payload
 */
export interface PayloadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Opções de validação de payload
 */
export interface PayloadValidationOptions {
  maxSizeBytes?: number;
  maxDepth?: number;
  allowArrayRoot?: boolean;
}

/**
 * Calcula a profundidade de um objeto
 * Começa em 1 para o objeto raiz
 */
function getObjectDepth(obj: any, currentDepth: number = 1): number {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  if (currentDepth > 50) {
    // Proteção contra stack overflow
    return currentDepth;
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj);
  const depths = values.map((value) => getObjectDepth(value, currentDepth + 1));

  return depths.length > 0 ? Math.max(...depths) : currentDepth;
}

/**
 * Valida estrutura e limites de um payload de webhook
 * @param payload - Payload a ser validado
 * @param options - Opções de validação
 * @returns Resultado da validação com mensagem de erro se inválido
 */
export function validateWebhookPayload(
  payload: any,
  options: PayloadValidationOptions = {},
): PayloadValidationResult {
  const {
    maxSizeBytes = 10 * 1024 * 1024, // 10MB default
    maxDepth = 20,
    allowArrayRoot = false,
  } = options;

  // Rejeitar null/undefined
  if (payload === null || payload === undefined) {
    return { valid: false, error: 'Payload cannot be null or undefined' };
  }

  // Aceitar apenas objetos
  if (typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }

  // Validar array root
  if (!allowArrayRoot && Array.isArray(payload)) {
    return { valid: false, error: 'Payload root cannot be an array' };
  }

  // Validar que pode ser serializado para JSON
  let jsonString: string;
  try {
    jsonString = JSON.stringify(payload);
  } catch {
    return {
      valid: false,
      error: 'Payload cannot be serialized to JSON (circular reference?)',
    };
  }

  // Validar tamanho
  const size = jsonString.length;
  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Payload exceeds maximum size of ${maxSizeBytes} bytes (current: ${size} bytes)`,
    };
  }

  // Validar profundidade
  const depth = getObjectDepth(payload);
  if (depth > maxDepth) {
    return {
      valid: false,
      error: `Payload exceeds maximum depth of ${maxDepth} levels (current: ${depth} levels)`,
    };
  }

  return { valid: true };
}

/**
 * Gera um payload padrão para testes de webhook
 */
export function generateWebhookPayload(overrides: any = {}): any {
  return {
    message: {
      text: 'Test message',
      from: '+5519971302477',
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Aguarda múltiplos jobs em paralelo
 */
export async function waitForMultipleJobs(
  jobIds: string[],
  timeout: number = 10000,
  throwOnError: boolean = true,
): Promise<any[]> {
  const promises = jobIds.map((jobId) =>
    waitForJobCompletion(jobId, timeout, throwOnError),
  );
  return await Promise.all(promises);
}

/**
 * Calcula duração de processamento de um job
 */
export async function calculateJobDuration(jobId: string): Promise<number> {
  const job = await webhookQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  const processedOn = job.processedOn;
  const finishedOn = job.finishedOn;

  if (!processedOn || !finishedOn) {
    throw new Error(`Job ${jobId} ainda não foi processado ou finalizado`);
  }

  return finishedOn - processedOn;
}

/**
 * Gera payload grande para testes de stress
 */
export function generateLargePayload(sizeInKB: number): any {
  const targetSize = sizeInKB * 1024;

  // Criar estrutura base primeiro para calcular overhead
  const basePayload = {
    message: {
      text: 'Large payload test',
      data: [] as any[],
    },
  };

  // Calcular overhead da estrutura base
  const baseSize = JSON.stringify(basePayload).length;
  const availableSize = targetSize - baseSize;

  // Criar item de exemplo para calcular tamanho por item
  const sampleItem = { id: 0, content: 'a'.repeat(100) };
  const itemSize = JSON.stringify(sampleItem).length + 1; // +1 para vírgula

  // Calcular quantos items cabem no espaço disponível
  const itemCount = Math.floor(availableSize / itemSize);

  // Gerar payload com tamanho aproximado correto
  basePayload.message.data = Array.from({ length: itemCount }, (_, i) => ({
    id: i,
    content: 'a'.repeat(100),
  }));

  return basePayload;
}

/**
 * Gera payload com nesting profundo
 */
export function generateNestedPayload(depth: number): any {
  let payload: any = { value: 'deepest level' };

  for (let i = 0; i < depth; i++) {
    payload = { level: i, nested: payload };
  }

  return { message: payload };
}

/**
 * Calcula o tamanho de um payload em bytes
 */
export function getPayloadSize(payload: any): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

/**
 * Gera um webhook request ID único para testes de idempotência
 */
export function createWebhookRequestId(): string {
  return `webhook-req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Simula um webhook com delay (para testes de timeout)
 */
export async function simulateSlowWebhook(
  flowId: string,
  webhookId: string,
  payload: any,
  delayMs: number,
): Promise<WebhookTestResult> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return await triggerAndWait(flowId, webhookId, payload);
}
