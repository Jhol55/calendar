'use server';

import { prisma } from '@/services/prisma';
import { getSession } from '@/utils/security/session';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

type MemoryResponse = {
  success: boolean;
  message?: string;
  code?: number;
  data?: unknown;
};

async function getUserEmailFromSession(): Promise<string | null> {
  const session = (await getSession()) as SessionUser | null;
  return session?.user?.email || null;
}

async function getUserIdFromSession(): Promise<string | null> {
  const session = (await getSession()) as SessionUser | null;

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  return user?.id ? String(user.id) : null;
}

export interface MemoryData {
  id: string;
  chave: string;
  valor: unknown;
  ttlSeconds: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryListResponse {
  data: MemoryData[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Buscar memórias com paginação
 */
export async function getMemories(options?: {
  offset?: number;
  limit?: number;
  search?: string;
}): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const search = options?.search?.toLowerCase().trim();

    // Construir filtro de busca
    // O userId na tabela chatbot_memories pode ser tanto email quanto ID numérico
    // Vamos buscar por ambos para garantir compatibilidade
    const userEmail = await getUserEmailFromSession();
    const where: any = {
      OR: [{ userId: userId }, ...(userEmail ? [{ userId: userEmail }] : [])],
    };

    if (search) {
      // Buscar apenas na chave por enquanto
      // A busca no valor JSON será feita no cliente após buscar os dados
      where.chave = { contains: search, mode: 'insensitive' };
    }

    // Buscar memórias
    const [memories, totalCount] = await Promise.all([
      prisma.chatbot_memories.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.chatbot_memories.count({ where }),
    ]);

    // Converter para formato da interface
    const memoryData: MemoryData[] = memories.map((memory) => {
      // Calcular TTL em segundos
      let ttlSeconds: number | null = null;
      if (memory.expiresAt && memory.createdAt) {
        const ttlMs = memory.expiresAt.getTime() - memory.createdAt.getTime();
        ttlSeconds = Math.max(0, Math.floor(ttlMs / 1000));
      }

      return {
        id: memory.id,
        chave: memory.chave,
        valor: memory.valor,
        ttlSeconds,
        expiresAt: memory.expiresAt,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      };
    });

    return {
      success: true,
      message: 'Memories loaded successfully',
      code: 200,
      data: {
        data: memoryData,
        totalCount,
        hasMore: offset + limit < totalCount,
      } as MemoryListResponse,
    };
  } catch (error) {
    console.error('Error fetching memories:', error);
    return {
      success: false,
      message: 'Failed to fetch memories',
      code: 500,
    };
  }
}

/**
 * Criar nova memória
 */
export async function createMemory(
  chave: string,
  valor: unknown,
  ttlSeconds?: number,
): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!chave || chave.trim() === '') {
      return {
        success: false,
        message: 'Chave is required',
        code: 400,
      };
    }

    // Calcular expiresAt
    let expiresAt: Date | null = null;
    if (ttlSeconds && ttlSeconds > 0) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    // Verificar se já existe memória com essa chave
    const existing = await prisma.chatbot_memories.findUnique({
      where: {
        userId_chave: {
          userId: userId,
          chave: chave.trim(),
        },
      },
    });

    if (existing) {
      return {
        success: false,
        message: 'Memory with this key already exists',
        code: 400,
      };
    }

    const memory = await prisma.chatbot_memories.create({
      data: {
        userId: userId, // ID numérico como string
        chave: chave.trim(),
        valor: valor as object,
        expiresAt,
      },
    });

    // Calcular TTL
    let ttlSecondsCalculated: number | null = null;
    if (memory.expiresAt && memory.createdAt) {
      const ttlMs = memory.expiresAt.getTime() - memory.createdAt.getTime();
      ttlSecondsCalculated = Math.max(0, Math.floor(ttlMs / 1000));
    }

    return {
      success: true,
      message: 'Memory created successfully',
      code: 200,
      data: {
        id: memory.id,
        chave: memory.chave,
        valor: memory.valor,
        ttlSeconds: ttlSecondsCalculated,
        expiresAt: memory.expiresAt,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      } as MemoryData,
    };
  } catch (error) {
    console.error('Error creating memory:', error);
    return {
      success: false,
      message: 'Failed to create memory',
      code: 500,
    };
  }
}

/**
 * Atualizar memória
 */
export async function updateMemory(
  id: string,
  updates: {
    chave?: string;
    valor?: unknown;
    ttlSeconds?: number | null;
  },
): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();
    const userEmail = await getUserEmailFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar memória existente
    const existing = await prisma.chatbot_memories.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: 'Memory not found',
        code: 404,
      };
    }

    // Verificar se pertence ao usuário (pode ser userId ou email)
    if (existing.userId !== userId && existing.userId !== userEmail) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Se está alterando a chave, verificar se não existe outra com a mesma chave
    if (updates.chave && updates.chave !== existing.chave) {
      // Buscar duplicata com userId (tentar ambos formatos)
      const duplicate = await prisma.chatbot_memories.findFirst({
        where: {
          OR: [
            {
              userId_chave: {
                userId: userId,
                chave: updates.chave.trim(),
              },
            },
            ...(userEmail
              ? [
                  {
                    userId_chave: {
                      userId: userId,
                      chave: updates.chave.trim(),
                    },
                  },
                ]
              : []),
          ],
        },
      });

      if (duplicate) {
        return {
          success: false,
          message: 'Memory with this key already exists',
          code: 400,
        };
      }
    }

    // Calcular expiresAt
    let expiresAt: Date | null = existing.expiresAt;
    if (updates.ttlSeconds !== undefined) {
      if (updates.ttlSeconds === null || updates.ttlSeconds === 0) {
        expiresAt = null;
      } else {
        // Se temos o createdAt original, usar ele; senão usar agora
        const baseDate = existing.createdAt || new Date();
        expiresAt = new Date(baseDate.getTime() + updates.ttlSeconds * 1000);
      }
    }

    // Preparar dados de atualização
    const updateData: any = {};
    if (updates.chave !== undefined) {
      updateData.chave = updates.chave.trim();
    }
    if (updates.valor !== undefined) {
      updateData.valor = updates.valor as object;
    }
    if (updates.ttlSeconds !== undefined) {
      updateData.expiresAt = expiresAt;
    }

    const memory = await prisma.chatbot_memories.update({
      where: { id },
      data: updateData,
    });

    // Calcular TTL
    let ttlSecondsCalculated: number | null = null;
    if (memory.expiresAt && memory.createdAt) {
      const ttlMs = memory.expiresAt.getTime() - memory.createdAt.getTime();
      ttlSecondsCalculated = Math.max(0, Math.floor(ttlMs / 1000));
    }

    return {
      success: true,
      message: 'Memory updated successfully',
      code: 200,
      data: {
        id: memory.id,
        chave: memory.chave,
        valor: memory.valor,
        ttlSeconds: ttlSecondsCalculated,
        expiresAt: memory.expiresAt,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      } as MemoryData,
    };
  } catch (error) {
    console.error('Error updating memory:', error);
    return {
      success: false,
      message: 'Failed to update memory',
      code: 500,
    };
  }
}

/**
 * Deletar memória
 */
export async function deleteMemory(id: string): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();
    const userEmail = await getUserEmailFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Verificar se a memória existe e pertence ao usuário
    const existing = await prisma.chatbot_memories.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: 'Memory not found',
        code: 404,
      };
    }

    if (existing.userId !== userId && existing.userId !== userEmail) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    await prisma.chatbot_memories.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Memory deleted successfully',
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting memory:', error);
    return {
      success: false,
      message: 'Failed to delete memory',
      code: 500,
    };
  }
}

/**
 * Deletar múltiplas memórias
 */
export async function deleteMemories(ids: string[]): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!ids || ids.length === 0) {
      return {
        success: false,
        message: 'No IDs provided',
        code: 400,
      };
    }

    // Deletar apenas memórias que pertencem ao usuário
    const result = await prisma.chatbot_memories.deleteMany({
      where: {
        id: { in: ids },
        userId: userId, // Usar numeric userId
      },
    });

    return {
      success: true,
      message: `${result.count} memories deleted successfully`,
      code: 200,
      data: { deletedCount: result.count },
    };
  } catch (error) {
    console.error('Error deleting memories:', error);
    return {
      success: false,
      message: 'Failed to delete memories',
      code: 500,
    };
  }
}

/**
 * Obter contagem total de memórias
 */
export async function getMemoryCount(search?: string): Promise<MemoryResponse> {
  try {
    const userId = await getUserIdFromSession();
    const userEmail = await getUserEmailFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const searchLower = search?.toLowerCase().trim();

    const where: any = {
      OR: [{ userId: userId }, ...(userEmail ? [{ userId: userEmail }] : [])],
    };

    if (searchLower) {
      // Buscar apenas na chave por enquanto
      where.chave = { contains: searchLower, mode: 'insensitive' };
    }

    const count = await prisma.chatbot_memories.count({ where });

    return {
      success: true,
      message: 'Count retrieved successfully',
      code: 200,
      data: { count },
    };
  } catch (error) {
    console.error('Error getting memory count:', error);
    return {
      success: false,
      message: 'Failed to get memory count',
      code: 500,
    };
  }
}
