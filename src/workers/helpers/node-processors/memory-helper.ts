/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../../services/prisma';
import type { WebhookJobData } from '@/services/queue';
import { replaceVariables } from '../variable-replacer';

interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface MemoryItem {
  key: string;
  value: string;
}

interface MemoryConfig {
  action: 'save' | 'fetch' | 'delete';
  memoryName: string;
  items?: MemoryItem[];
  ttl?: number;
  defaultValue?: string;
  saveMode?: 'overwrite' | 'append';
}

interface NodeExecutionsRecord {
  [nodeId: string]: {
    status: string;
    result?: any;
    startTime?: string;
    endTime?: string;
  };
}

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

/**
 * Função reutilizável para processar memória em qualquer node
 *
 * Permite que qualquer nó do fluxo salve/busque/delete memórias
 * através de uma configuração de memória anexada ao nó
 *
 * @example
 * ```typescript
 * const memoryResult = nodeConfig.memoryConfig
 *   ? await processNodeMemory(
 *       nodeConfig.memoryConfig,
 *       executionId,
 *       variableContext,
 *     )
 *   : undefined;
 *
 * return {
 *   ...otherResults,
 *   memoryResult,
 * };
 * ```
 */
export async function processNodeMemory(
  memoryConfig: MemoryConfig,
  executionId: string,
  variableContext: any,
): Promise<unknown> {
  console.log('🧠 Processing memory configuration');
  console.log('📦 Variable Context received:', {
    hasNode: !!variableContext.$node,
    hasOutput: !!variableContext.$node?.output,
    outputKeys: variableContext.$node?.output
      ? Object.keys(variableContext.$node.output)
      : [],
    apiResponseKeys: variableContext.$node?.output?.apiResponse
      ? Object.keys(variableContext.$node.output.apiResponse)
      : [],
  });

  try {
    // Buscar execução para obter userId
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    const userId = execution?.flow?.userId
      ? String(execution.flow.userId)
      : null;

    if (!userId) {
      console.warn('⚠️ UserId not found, skipping memory processing');
      return {
        error: true,
        message: 'UserId not found',
      };
    }

    const { action, memoryName, items, ttl, defaultValue, saveMode } =
      memoryConfig;

    // Resolver variáveis no memoryName
    const resolvedMemoryName = replaceVariables(memoryName, variableContext);

    switch (action) {
      case 'save': {
        if (!items || items.length === 0) {
          console.warn('⚠️ No items to save in memory');
          return {
            error: true,
            message: 'No items to save',
          };
        }

        // Resolver variáveis em cada item
        const resolvedItems: Record<string, string> = {};
        items.forEach((item) => {
          console.log('🔍 Resolving memory item:', {
            originalKey: item.key,
            originalValue: item.value,
            contextKeys: Object.keys(variableContext),
            hasNodeOutput: !!variableContext.$node?.output,
            nodeOutputKeys: variableContext.$node?.output
              ? Object.keys(variableContext.$node.output)
              : [],
          });

          const resolvedKey = replaceVariables(item.key, variableContext);
          const resolvedValue = replaceVariables(item.value, variableContext);

          console.log('✅ Resolved memory item:', {
            resolvedKey,
            resolvedValue,
          });

          // Verificar se as variáveis foram realmente resolvidas
          if (typeof resolvedKey === 'string' && resolvedKey.includes('{{')) {
            console.error(
              '⚠️ [MEMORY] Key still has unresolved variables:',
              resolvedKey,
            );
            console.error(
              '   Available $nodes:',
              variableContext.$nodes
                ? Object.keys(variableContext.$nodes)
                : 'undefined',
            );
          }
          if (
            typeof resolvedValue === 'string' &&
            resolvedValue.includes('{{')
          ) {
            console.error(
              '⚠️ [MEMORY] Value still has unresolved variables:',
              resolvedValue,
            );
            console.error(
              '   Available $nodes:',
              variableContext.$nodes
                ? Object.keys(variableContext.$nodes)
                : 'undefined',
            );

            // Tentar extrair o node ID da variável não resolvida
            const nodeMatch = resolvedValue.match(/\{\{\$nodes\.([^.]+)/);
            if (nodeMatch) {
              const nodeId = nodeMatch[1];
              console.error(`   ❌ Node "${nodeId}" not found in context!`);
              console.error(`   Did this node execute before the memory node?`);
            }
          }

          resolvedItems[resolvedKey] = resolvedValue;
        });

        // Implementar lógica de saveMode
        let finalValue: unknown = resolvedItems;
        if (saveMode === 'append') {
          // Buscar valor existente e adicionar à lista
          const existingMemory = await buscarMemoria(
            userId,
            resolvedMemoryName,
          );
          if (existingMemory.found && existingMemory.value) {
            // Se já existe, adicionar o novo valor à lista
            const existingArray = Array.isArray(existingMemory.value)
              ? existingMemory.value
              : [existingMemory.value];
            finalValue = [...existingArray, resolvedItems];
          } else {
            // Se não existe, criar nova lista
            finalValue = [resolvedItems];
          }
        }

        // Salvar na memória
        const saveResult = await salvarMemoria(
          userId,
          resolvedMemoryName,
          finalValue,
          ttl,
        );

        return {
          action: 'save',
          name: resolvedMemoryName,
          items: resolvedItems,
          saveMode: saveMode || 'overwrite',
          success: saveResult.success,
          expiresAt: saveResult.expiresAt,
        };
      }

      case 'fetch': {
        // Buscar memória
        const searchResult = await buscarMemoria(userId, resolvedMemoryName);

        let parsedValue = searchResult.value;

        // Se não encontrou, usar valor padrão
        if (!searchResult.found && defaultValue) {
          parsedValue = replaceVariables(defaultValue, variableContext);
        }

        // Parser inteligente para valores de memória
        if (searchResult.found && typeof searchResult.value === 'string') {
          const stringValue = searchResult.value as string;

          // Tentar parsear como JSON puro primeiro
          try {
            parsedValue = JSON.parse(stringValue);
            console.log(`✅ [NODE-MEMORY] Parsed as pure JSON`);
          } catch {
            // Se falhar, tentar converter formato JavaScript para JSON
            console.log(`⚠️ [NODE-MEMORY] Trying to convert JS format...`);
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

              parsedValue = JSON.parse(jsFormatted);
              console.log(
                `✅ [NODE-MEMORY] Converted from JS format successfully`,
              );
            } catch {
              console.log(`✅ [NODE-MEMORY] Keeping as string`);
              parsedValue = stringValue;
            }
          }
        }

        // Calcular metadados sobre o valor
        const valueType = Array.isArray(parsedValue)
          ? 'array'
          : parsedValue === null
            ? 'null'
            : typeof parsedValue;

        // Calcular itemCount de forma inteligente
        let itemCount: number | undefined = undefined;
        if (Array.isArray(parsedValue)) {
          // Se for array com 1 elemento que tem estrutura {key, value}
          // onde value é array, contar os items dentro de value
          if (
            parsedValue.length === 1 &&
            typeof parsedValue[0] === 'object' &&
            parsedValue[0] !== null &&
            'key' in parsedValue[0] &&
            'value' in parsedValue[0] &&
            Array.isArray(parsedValue[0].value)
          ) {
            itemCount = parsedValue[0].value.length;
            console.log(
              `📊 [NODE-MEMORY] Detected memory structure with nested value array`,
            );
          } else {
            itemCount = parsedValue.length;
          }
        }

        const isEmpty =
          parsedValue === null ||
          parsedValue === undefined ||
          (typeof parsedValue === 'string' && parsedValue.trim() === '') ||
          (Array.isArray(parsedValue) && parsedValue.length === 0) ||
          (typeof parsedValue === 'object' &&
            !Array.isArray(parsedValue) &&
            Object.keys(parsedValue).length === 0);

        console.log(`🔍 [NODE-MEMORY] Parsed value type: ${valueType}`);
        console.log(`🔍 [NODE-MEMORY] Item count: ${itemCount ?? 'N/A'}`);
        console.log(`🔍 [NODE-MEMORY] Is empty: ${isEmpty}`);

        return {
          action: 'fetch',
          name: resolvedMemoryName,
          value: parsedValue,
          valueType,
          itemCount,
          isEmpty,
          found: searchResult.found,
          expired: searchResult.expired,
          usedDefault: !searchResult.found,
        };
      }

      case 'delete': {
        // Deletar memória
        const deleteResult = await deletarMemoria(userId, resolvedMemoryName);

        return {
          action: 'delete',
          name: resolvedMemoryName,
          success: deleteResult.success,
          found: deleteResult.found,
        };
      }

      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  } catch (error) {
    console.error('❌ Error processing memory:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Processador do Memory Node standalone
 *
 * Este é um nó dedicado apenas para gerenciar memórias,
 * diferente do processNodeMemory que pode ser anexado a qualquer nó
 */
export async function processMemoryNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
  variableContext?: Record<string, unknown>,
): Promise<unknown> {
  console.log('🧠 Processing memory node');

  const memoryConfig = node.data?.memoryConfig as MemoryConfig | undefined;

  if (!memoryConfig) {
    throw new Error('Memory configuration not found');
  }

  const { action, memoryName, items, ttl, defaultValue, saveMode } =
    memoryConfig as MemoryConfig & { saveMode?: 'overwrite' | 'append' };

  if (!memoryName) {
    throw new Error('memoryName (memory name) is required');
  }

  try {
    // Buscar execução para obter flow e userId
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    if (!execution?.flow?.userId) {
      throw new Error('UserId not found in flow');
    }

    const userId = String(execution.flow.userId);

    // Usar variableContext passado ou construir um novo
    let context = variableContext;
    if (!context) {
      // Buscar dados de todos os nodes anteriores
      const nodeExecutions =
        (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};

      // Criar objeto $nodes com saídas de todos os nodes anteriores
      const $nodes: Record<string, { output: unknown }> = {};
      Object.keys(nodeExecutions).forEach((nodeId) => {
        const nodeExec = nodeExecutions[nodeId];
        if (nodeExec?.result) {
          $nodes[nodeId] = {
            output: nodeExec.result,
          };
        }
      });

      // Buscar todas as memórias do usuário para o contexto
      const $memory = await listarMemorias(userId);

      // Preparar contexto para substituição de variáveis
      context = {
        $node: {
          input: webhookData.body,
        },
        $nodes,
        $memory,
      };
    }

    // Resolver variáveis no nome da memória
    const resolvedMemoryName = replaceVariables(memoryName, context);

    console.log(`🧠 Memory action: ${action} - name: ${resolvedMemoryName}`);

    // Processar baseado na ação
    switch (action) {
      case 'save': {
        if (!items || items.length === 0) {
          throw new Error('Items are required for action "save"');
        }

        // Processar cada item e substituir variáveis
        const resolvedItems = items.map((item) => {
          const resolvedKey = replaceVariables(item.key, context);
          const resolvedValue = replaceVariables(item.value, context);

          console.log('✅ [MEMORY-NODE] Resolved item:', {
            resolvedKey,
            resolvedValue,
          });

          // Verificar se as variáveis foram realmente resolvidas
          if (
            typeof resolvedValue === 'string' &&
            resolvedValue.includes('{{')
          ) {
            console.error(
              '⚠️ [MEMORY-NODE] Value still has unresolved variables:',
              resolvedValue,
            );
            console.error(
              '   Available $nodes:',
              (context as any).$nodes
                ? Object.keys((context as any).$nodes)
                : 'undefined',
            );

            // Tentar extrair o node ID da variável não resolvida
            const nodeMatch = resolvedValue.match(/\{\{\$nodes\.([^.]+)/);
            if (nodeMatch) {
              const nodeId = nodeMatch[1];
              console.error(`   ❌ Node "${nodeId}" not found in context!`);
              console.error(`   Did this node execute before the memory node?`);
            }
          }

          return {
            key: resolvedKey,
            value: resolvedValue,
          };
        });

        let finalValue: string;

        if (saveMode === 'append') {
          // Modo APPEND: Adicionar à lista existente
          const existingMemory = await buscarMemoria(
            userId,
            resolvedMemoryName,
          );
          let existingItems: Array<{ key: string; value: string }> = [];

          if (
            existingMemory.found &&
            existingMemory.value &&
            typeof existingMemory.value === 'string'
          ) {
            try {
              existingItems = JSON.parse(existingMemory.value as string);
              if (!Array.isArray(existingItems)) {
                existingItems = [];
              }
            } catch {
              // Se não for JSON válido, começar com array vazio
              existingItems = [];
            }
          }

          // Adicionar novos items à lista existente
          const combinedItems = [...existingItems, ...resolvedItems];
          finalValue = JSON.stringify(combinedItems);

          console.log(
            `➕ Memory append: ${resolvedMemoryName} - added ${resolvedItems.length} items to existing ${existingItems.length} items`,
          );
        } else {
          // Modo OVERWRITE: Substituir completamente
          finalValue = JSON.stringify(resolvedItems);

          console.log(
            `🔄 Memory overwrite: ${resolvedMemoryName} with ${resolvedItems.length} items`,
          );
        }

        // Salvar memória
        const saveResult = await salvarMemoria(
          userId,
          resolvedMemoryName,
          finalValue,
          ttl,
        );

        return {
          type: 'memory',
          action: 'save',
          name: resolvedMemoryName,
          items: resolvedItems,
          saveMode: saveMode || 'overwrite',
          success: saveResult.success,
          expiresAt: saveResult.expiresAt,
        };
      }

      case 'fetch': {
        // Buscar memória
        const searchResult = await buscarMemoria(
          userId,
          resolvedMemoryName,
          defaultValue,
        );

        // Parser inteligente para valores de memória
        let parsedValue = searchResult.value;
        if (searchResult.found && typeof searchResult.value === 'string') {
          const stringValue = searchResult.value as string;

          // Tentar parsear como JSON puro primeiro
          try {
            parsedValue = JSON.parse(stringValue);
            console.log(`✅ [MEMORY] Parsed as pure JSON`);
          } catch {
            // Se falhar, tentar converter formato JavaScript para JSON
            console.log(`⚠️ [MEMORY] Trying to convert JS format...`);
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

              parsedValue = JSON.parse(jsFormatted);
              console.log(`✅ [MEMORY] Converted from JS format successfully`);
            } catch {
              console.log(`✅ [MEMORY] Keeping as string`);
              parsedValue = stringValue;
            }
          }
        }

        // Calcular metadados sobre o valor
        const valueType = Array.isArray(parsedValue)
          ? 'array'
          : parsedValue === null
            ? 'null'
            : typeof parsedValue;

        // Calcular itemCount de forma inteligente
        let itemCount: number | undefined = undefined;
        if (Array.isArray(parsedValue)) {
          // Se for array com 1 elemento que tem estrutura {key, value}
          // onde value é array, contar os items dentro de value
          if (
            parsedValue.length === 1 &&
            typeof parsedValue[0] === 'object' &&
            parsedValue[0] !== null &&
            'key' in parsedValue[0] &&
            'value' in parsedValue[0] &&
            Array.isArray(parsedValue[0].value)
          ) {
            itemCount = parsedValue[0].value.length;
            console.log(
              `📊 [MEMORY] Detected memory structure with nested value array`,
            );
          } else {
            itemCount = parsedValue.length;
          }
        }

        const isEmpty =
          parsedValue === null ||
          parsedValue === undefined ||
          (typeof parsedValue === 'string' && parsedValue.trim() === '') ||
          (Array.isArray(parsedValue) && parsedValue.length === 0) ||
          (typeof parsedValue === 'object' &&
            !Array.isArray(parsedValue) &&
            Object.keys(parsedValue).length === 0);

        console.log(
          `🔍 Memory search: ${resolvedMemoryName}, found: ${searchResult.found}`,
        );
        console.log(`🔍 Memory parsed value type: ${valueType}`);
        console.log(`🔍 Memory item count: ${itemCount ?? 'N/A'}`);
        console.log(`🔍 Memory is empty: ${isEmpty}`);

        return {
          type: 'memory',
          action: 'fetch',
          name: resolvedMemoryName,
          value: parsedValue,
          valueType,
          itemCount,
          isEmpty,
          found: searchResult.found,
          expired: searchResult.expired,
          usedDefault: !searchResult.found,
        };
      }

      case 'delete': {
        // Deletar memória
        const deleteResult = await deletarMemoria(userId, resolvedMemoryName);

        console.log(
          `🗑️ Memory deleted: ${resolvedMemoryName}, found: ${deleteResult.found}`,
        );

        return {
          type: 'memory',
          action: 'delete',
          name: resolvedMemoryName,
          success: deleteResult.success,
          found: deleteResult.found,
        };
      }

      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  } catch (error) {
    console.error(`❌ Error processing memory node:`, error);
    throw error;
  }
}
