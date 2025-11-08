/**
 * Serviço para gerenciar histórico de conversas dos agents
 */

import { prisma } from './prisma';
import { ChatMessage } from './openai.service';

// Type helper para Prisma JSON fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaJsonValue = any;

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Busca ou cria uma conversa para um usuário
 */
export async function getOrCreateConversation(
  userId: string,
  flowId?: string,
  nodeId?: string,
  maxLength: number = 10,
) {
  // Tentar buscar conversa existente
  // Para campos opcionais em chaves compostas, sempre incluir (usar null quando undefined)
  // Type assertion necessária devido à limitação do Prisma com campos opcionais em chaves compostas
  const existing = await prisma.agent_conversations.findUnique({
    where: {
      userId_flowId_nodeId: {
        userId,
        flowId: flowId ?? null,
        nodeId: nodeId ?? null,
      } as unknown as {
        userId: string;
        flowId: string;
        nodeId: string;
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Criar nova conversa
  return prisma.agent_conversations.create({
    data: {
      userId,
      ...(flowId !== undefined && { flowId: flowId ?? null }),
      ...(nodeId !== undefined && { nodeId: nodeId ?? null }),
      messages: [],
      maxLength,
      lastMessageAt: new Date(),
    },
  });
}

/**
 * Adiciona mensagens ao histórico
 */
export async function addMessagesToHistory(
  userId: string,
  messages: ChatMessage[],
  flowId?: string,
  nodeId?: string,
  maxLength: number = 10,
) {
  const conversation = await getOrCreateConversation(
    userId,
    flowId,
    nodeId,
    maxLength,
  );

  // Converter ChatMessage para ConversationMessage
  const newMessages: ConversationMessage[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    timestamp: new Date(),
    metadata: {
      tool_call_id: msg.tool_call_id,
      tool_calls: msg.tool_calls,
      function_call: msg.function_call,
      name: msg.name,
    },
  }));

  // Pegar mensagens existentes
  const existingMessages =
    (conversation.messages as unknown as ConversationMessage[]) || [];

  // Adicionar novas mensagens
  const allMessages = [...existingMessages, ...newMessages];

  // Truncar para maxLength (mantendo system messages)
  const systemMessages = allMessages.filter((m) => m.role === 'system');
  const otherMessages = allMessages.filter((m) => m.role !== 'system');
  const truncatedOthers =
    otherMessages.length > maxLength
      ? otherMessages.slice(-maxLength)
      : otherMessages;
  const finalMessages = [...systemMessages, ...truncatedOthers];

  // Atualizar no banco
  return prisma.agent_conversations.update({
    where: {
      userId_flowId_nodeId: {
        userId,
        flowId: flowId ?? null,
        nodeId: nodeId ?? null,
      } as unknown as {
        userId: string;
        flowId: string;
        nodeId: string;
      },
    },
    data: {
      messages: finalMessages as PrismaJsonValue,
      lastMessageAt: new Date(),
    },
  });
}

/**
 * Busca histórico de mensagens
 */
export async function getConversationHistory(
  userId: string,
  flowId?: string,
  nodeId?: string,
): Promise<ChatMessage[]> {
  const conversation = await prisma.agent_conversations.findUnique({
    where: {
      userId_flowId_nodeId: {
        userId,
        flowId: flowId ?? null,
        nodeId: nodeId ?? null,
      } as unknown as {
        userId: string;
        flowId: string;
        nodeId: string;
      },
    },
  });

  if (!conversation) {
    return [];
  }

  const messages =
    (conversation.messages as unknown as ConversationMessage[]) || [];

  // Converter de volta para ChatMessage
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ...msg.metadata,
  }));
}

/**
 * Limpa histórico de uma conversa
 */
export async function clearConversationHistory(
  userId: string,
  flowId?: string,
  nodeId?: string,
) {
  return prisma.agent_conversations.updateMany({
    where: {
      userId,
      flowId,
      nodeId,
    },
    data: {
      messages: [],
      lastMessageAt: new Date(),
    },
  });
}

/**
 * Remove conversas expiradas
 */
export async function cleanupExpiredConversations() {
  return prisma.agent_conversations.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });
}
