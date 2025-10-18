import { prisma } from '../services/prisma';

/**
 * Salva ou atualiza uma memória
 */
export async function salvarMemoria(
  userId: string,
  chave: string,
  valor: unknown,
  ttlSeconds?: number,
): Promise<{ success: boolean; expiresAt?: Date }> {
  try {
    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null;

    await prisma.chatbot_memories.upsert({
      where: {
        userId_chave: {
          userId,
          chave,
        },
      },
      create: {
        userId,
        chave,
        valor: valor as object,
        expiresAt,
      },
      update: {
        valor: valor as object,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    console.log(`💾 Memória salva: ${userId}/${chave}`, {
      expiresAt,
      hasValue: !!valor,
    });

    return {
      success: true,
      expiresAt: expiresAt || undefined,
    };
  } catch (error) {
    console.error(`❌ Erro ao salvar memória ${userId}/${chave}:`, error);
    throw error;
  }
}

/**
 * Busca uma memória
 * - Se expirada, deleta e retorna valor padrão
 * - Se não encontrar, retorna valor padrão
 */
export async function buscarMemoria(
  userId: string,
  chave: string,
  valorPadrao?: unknown,
): Promise<{ found: boolean; value: unknown; expired: boolean }> {
  try {
    const memoria = await prisma.chatbot_memories.findUnique({
      where: {
        userId_chave: {
          userId,
          chave,
        },
      },
    });

    // Não encontrou
    if (!memoria) {
      console.log(`🔍 Memória não encontrada: ${userId}/${chave}`);
      return {
        found: false,
        value: valorPadrao,
        expired: false,
      };
    }

    // Verificar se expirou
    if (memoria.expiresAt && memoria.expiresAt < new Date()) {
      console.log(`⏰ Memória expirada: ${userId}/${chave}, deletando...`);

      // Deletar memória expirada
      await prisma.chatbot_memories.delete({
        where: { id: memoria.id },
      });

      return {
        found: false,
        value: valorPadrao,
        expired: true,
      };
    }

    // Memória válida
    console.log(`✅ Memória encontrada: ${userId}/${chave}`);
    return {
      found: true,
      value: memoria.valor,
      expired: false,
    };
  } catch (error) {
    console.error(`❌ Erro ao buscar memória ${userId}/${chave}:`, error);
    return {
      found: false,
      value: valorPadrao,
      expired: false,
    };
  }
}

/**
 * Deleta uma memória específica
 */
export async function deletarMemoria(
  userId: string,
  chave: string,
): Promise<{ success: boolean; found: boolean }> {
  try {
    const memoria = await prisma.chatbot_memories.findUnique({
      where: {
        userId_chave: {
          userId,
          chave,
        },
      },
    });

    if (!memoria) {
      console.log(`🔍 Memória não encontrada para deletar: ${userId}/${chave}`);
      return { success: true, found: false };
    }

    await prisma.chatbot_memories.delete({
      where: { id: memoria.id },
    });

    console.log(`🗑️ Memória deletada: ${userId}/${chave}`);
    return { success: true, found: true };
  } catch (error) {
    console.error(`❌ Erro ao deletar memória ${userId}/${chave}:`, error);
    throw error;
  }
}

/**
 * Lista todas as memórias de um usuário (apenas válidas)
 */
export async function listarMemorias(
  userId: string,
): Promise<Record<string, unknown>> {
  try {
    const memorias = await prisma.chatbot_memories.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null }, // Sem expiração
          { expiresAt: { gte: new Date() } }, // Ainda não expirou
        ],
      },
    });

    const memoriasMap: Record<string, unknown> = {};

    memorias.forEach((memoria) => {
      memoriasMap[memoria.chave] = memoria.valor;
    });

    console.log(
      `📋 Listando ${memorias.length} memórias para usuário: ${userId}`,
    );

    return memoriasMap;
  } catch (error) {
    console.error(`❌ Erro ao listar memórias de ${userId}:`, error);
    return {};
  }
}

/**
 * Limpa memórias expiradas (para job de limpeza)
 */
export async function limparMemoriasExpiradas(): Promise<number> {
  try {
    const result = await prisma.chatbot_memories.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
    });

    console.log(`🧹 Limpeza: ${result.count} memórias expiradas removidas`);
    return result.count;
  } catch (error) {
    console.error('❌ Erro na limpeza de memórias expiradas:', error);
    return 0;
  }
}
