import { prisma } from '../services/prisma';

/**
 * Parser inteligente para valores de memória
 * Tenta converter strings JSON ou formato JavaScript para objetos
 * Parseia recursivamente arrays e objetos
 */
function parseMemoryValue(value: unknown): unknown {
  // Se for null ou undefined, retornar como está
  if (value === null || value === undefined) {
    return value;
  }

  // Se for array, parsear cada elemento recursivamente
  if (Array.isArray(value)) {
    return value.map((item) => parseMemoryValue(item));
  }

  // Se for objeto (mas não array), parsear cada propriedade recursivamente
  if (typeof value === 'object') {
    const parsed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      parsed[key] = parseMemoryValue(val);
    }
    return parsed;
  }

  // Se não for string, retornar como está
  if (typeof value !== 'string') {
    return value;
  }

  const stringValue = value as string;

  // Tentar parsear como JSON puro primeiro
  try {
    const parsed = JSON.parse(stringValue);
    console.log(`✅ [MEMORY-PARSER] Parsed string as JSON`);
    // Recursivamente parsear o resultado
    return parseMemoryValue(parsed);
  } catch {
    // Se falhar, tentar converter formato JavaScript para JSON
    console.log(`⚠️ [MEMORY-PARSER] Trying to convert JS format...`);
    try {
      let jsFormatted = stringValue.trim();

      // Substituir [Array] por []
      jsFormatted = jsFormatted.replace(/\[\s*\[Array\]\s*\]/g, '[]');

      // Adicionar aspas em chaves sem aspas
      jsFormatted = jsFormatted.replace(
        /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":',
      );

      // Substituir aspas simples por duplas
      jsFormatted = jsFormatted.replace(/:\s*'([^']*)'/g, ': "$1"');
      jsFormatted = jsFormatted.replace(/\[\s*'([^']*)'/g, '["$1"');
      jsFormatted = jsFormatted.replace(/',\s*'/g, '", "');
      jsFormatted = jsFormatted.replace(/'\s*\]/g, '"]');

      const parsed = JSON.parse(jsFormatted);
      console.log(`✅ [MEMORY-PARSER] Converted from JS format successfully`);
      // Recursivamente parsear o resultado
      return parseMemoryValue(parsed);
    } catch {
      console.log(`✅ [MEMORY-PARSER] Keeping as string`);
      return stringValue;
    }
  }
}

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

    // Memória válida - parsear o valor
    console.log(`✅ Memória encontrada: ${userId}/${chave}`);
    return {
      found: true,
      value: parseMemoryValue(memoria.valor),
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
      // Parsear o valor automaticamente
      memoriasMap[memoria.chave] = parseMemoryValue(memoria.valor);
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
