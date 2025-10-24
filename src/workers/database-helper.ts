// ============================================
// DATABASE NODE EXECUTOR
// Executa operações do database-node
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { databaseNodeService } from '@/services/database/database.service';
import type { DatabaseNodeConfig } from '@/services/database/database.types';

/**
 * Interface do contexto de execução
 */
export interface ExecutionContext {
  userId: string;
  flowId: string;
  executionId: string;
  variables: Record<string, any>;
}

/**
 * Interface do node
 */
export interface Node {
  id: string;
  type: string;
  data?: {
    label?: string;
    config?: DatabaseNodeConfig;
    [key: string]: any;
  };
}

/**
 * Executa um database-node
 */
export async function executeDatabaseNode(
  node: Node,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  const config = node.data?.databaseConfig as DatabaseNodeConfig;

  if (!config) {
    throw new Error('Database node config não encontrado');
  }

  const { operation, tableName } = config;
  const userId = context.userId;

  console.log(
    `🗄️  Executando database-node [${operation}] na tabela "${tableName}"`,
  );

  try {
    switch (operation) {
      case 'addColumns':
        return await handleAddColumns(userId, config);

      case 'removeColumns':
        return await handleRemoveColumns(userId, config);

      case 'insert':
        return await handleInsert(userId, config, input, context);

      case 'update':
        return await handleUpdate(userId, config, input, context);

      case 'delete':
        return await handleDelete(userId, config, input, context);

      case 'get':
        return await handleGet(userId, config, input, context);

      default:
        throw new Error(`Operação "${operation}" não suportada`);
    }
  } catch (error: any) {
    console.error(`❌ Erro no database-node [${operation}]:`, error);
    throw error;
  }
}

// ============================================
// HANDLERS DE CADA OPERAÇÃO
// ============================================

/**
 * Handler: addColumns
 */
async function handleAddColumns(
  userId: string,
  config: DatabaseNodeConfig,
): Promise<any> {
  if (!config.columns || config.columns.length === 0) {
    throw new Error('Nenhuma coluna especificada para adicionar');
  }

  const schema = await databaseNodeService.addColumns(
    userId,
    config.tableName,
    config.columns,
  );

  return {
    success: true,
    operation: 'addColumns',
    tableName: config.tableName,
    schema,
    message: `${config.columns.length} coluna(s) adicionada(s) com sucesso`,
  };
}

/**
 * Handler: removeColumns
 */
async function handleRemoveColumns(
  userId: string,
  config: DatabaseNodeConfig,
): Promise<any> {
  if (!config.columnsToRemove || config.columnsToRemove.length === 0) {
    throw new Error('Nenhuma coluna especificada para remover');
  }

  const schema = await databaseNodeService.removeColumns(
    userId,
    config.tableName,
    config.columnsToRemove,
  );

  return {
    success: true,
    operation: 'removeColumns',
    tableName: config.tableName,
    schema,
    message: `${config.columnsToRemove.length} coluna(s) removida(s) com sucesso`,
  };
}

/**
 * Handler: insert
 */
async function handleInsert(
  userId: string,
  config: DatabaseNodeConfig,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  if (!config.record) {
    throw new Error('Nenhum registro especificado para inserir');
  }

  console.log(
    '📝 [INSERT] Config record:',
    JSON.stringify(config.record, null, 2),
  );
  console.log('📝 [INSERT] Context variables:', {
    hasInput: !!input,
    hasNodes: !!context.variables?.nodes,
    nodeKeys: context.variables?.nodes
      ? Object.keys(context.variables.nodes)
      : [],
    hasMemory: !!context.variables?.memory,
  });

  // Resolve variáveis no registro
  const resolvedRecord = resolveVariables(config.record, input, context);

  console.log(
    '✅ [INSERT] Resolved record:',
    JSON.stringify(resolvedRecord, null, 2),
  );

  const newRecord = await databaseNodeService.insertRecord(
    userId,
    config.tableName,
    resolvedRecord,
  );

  console.log('✅ [INSERT] New record created with ID:', newRecord._id);

  return {
    success: true,
    operation: 'insert',
    tableName: config.tableName,
    record: newRecord,
    message: 'Registro inserido com sucesso',
  };
}

/**
 * Handler: update
 */
async function handleUpdate(
  userId: string,
  config: DatabaseNodeConfig,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  if (!config.filters) {
    throw new Error('Nenhum filtro especificado para atualização');
  }

  if (!config.updates) {
    throw new Error('Nenhuma atualização especificada');
  }

  // Resolve variáveis nos filtros e updates
  const resolvedFilters = resolveVariables(config.filters, input, context);
  const resolvedUpdates = resolveVariables(config.updates, input, context);

  const result = await databaseNodeService.updateRecords(
    userId,
    config.tableName,
    resolvedFilters,
    resolvedUpdates,
  );

  return {
    success: true,
    operation: 'update',
    tableName: config.tableName,
    affected: result.affected,
    records: result.records,
    message: `${result.affected} registro(s) atualizado(s)`,
  };
}

/**
 * Handler: delete
 */
async function handleDelete(
  userId: string,
  config: DatabaseNodeConfig,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  if (!config.filters) {
    throw new Error('Nenhum filtro especificado para exclusão');
  }

  // Resolve variáveis nos filtros
  const resolvedFilters = resolveVariables(config.filters, input, context);

  const result = await databaseNodeService.deleteRecords(
    userId,
    config.tableName,
    resolvedFilters,
  );

  return {
    success: true,
    operation: 'delete',
    tableName: config.tableName,
    affected: result.affected,
    message: `${result.affected} registro(s) deletado(s)`,
  };
}

/**
 * Handler: get
 */
async function handleGet(
  userId: string,
  config: DatabaseNodeConfig,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  // Resolve variáveis nas opções de query
  const options = {
    filters: config.filters
      ? resolveVariables(config.filters, input, context)
      : undefined,
    sort: config.sort,
    pagination: config.pagination,
  };

  const records = await databaseNodeService.getRecords(
    userId,
    config.tableName,
    options,
  );

  return {
    success: true,
    operation: 'get',
    tableName: config.tableName,
    count: records.length,
    records,
    message: `${records.length} registro(s) encontrado(s)`,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Sanitiza valores resolvidos para prevenir injeção
 */
function sanitizeValue(value: any): any {
  // Se for string, escapar caracteres perigosos
  if (typeof value === 'string') {
    // Remover caracteres de controle
    return value.replace(/[\x00-\x1F\x7F]/g, '');
  }

  // Se for objeto, validar profundidade
  if (typeof value === 'object' && value !== null) {
    const validateDepth = (obj: any, depth: number = 0): void => {
      const MAX_DEPTH = 5;
      const MAX_PROPERTIES = 100;

      if (depth > MAX_DEPTH) {
        throw new Error(`Objeto muito profundo: máximo ${MAX_DEPTH} níveis`);
      }

      if (Array.isArray(obj)) {
        obj.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            validateDepth(item, depth + 1);
          }
        });
      } else {
        const keys = Object.keys(obj);
        if (keys.length > MAX_PROPERTIES) {
          throw new Error(
            `Objeto com muitas propriedades: máximo ${MAX_PROPERTIES}`,
          );
        }

        keys.forEach((key) => {
          if (BLOCKED_PROPERTIES.has(key)) {
            throw new Error(`Propriedade bloqueada detectada: ${key}`);
          }

          const val = obj[key];
          if (typeof val === 'object' && val !== null) {
            validateDepth(val, depth + 1);
          }
        });
      }
    };

    validateDepth(value);
  }

  return value;
}

/**
 * Resolve variáveis no formato {{variavel}} em um objeto
 */
function resolveVariables(
  obj: any,
  input: any,
  context: ExecutionContext,
): any {
  if (typeof obj === 'string') {
    return resolveString(obj, input, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariables(item, input, context));
  }

  if (obj && typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Bloquear chaves perigosas
      if (BLOCKED_PROPERTIES.has(key)) {
        console.error(`🚨 Tentativa de criar propriedade bloqueada: ${key}`);
        continue; // Pula a propriedade
      }
      resolved[key] = resolveVariables(value, input, context);
    }
    return resolved;
  }

  return obj;
}

/**
 * Resolve variáveis em uma string
 */
function resolveString(
  str: string,
  input: any,
  context: ExecutionContext,
): any {
  if (typeof str !== 'string') return str;

  // Padrão: {{variavel}} ou {{objeto.propriedade}}
  const regex = /\{\{([^}]+)\}\}/g;
  let hasVariables = false;

  const resolved = str.replace(regex, (match, path) => {
    hasVariables = true;
    const trimmedPath = path.trim();

    try {
      // Tenta resolver de múltiplas fontes
      const value = resolveValue(trimmedPath, { input, ...context.variables });

      if (value === undefined) {
        console.warn(`⚠️  Variável não encontrada: {{${trimmedPath}}}`);
        return match;
      }

      // Sanitizar o valor resolvido
      const sanitized = sanitizeValue(value);

      return sanitized !== undefined ? String(sanitized) : match;
    } catch (error: any) {
      console.error(
        `🚨 Erro ao resolver variável {{${trimmedPath}}}:`,
        error.message,
      );
      throw error; // Propagar erro de segurança
    }
  });

  // Se a string inteira era uma variável, retorna o valor original (não string)
  if (hasVariables && str.match(/^\{\{[^}]+\}\}$/)) {
    const path = str.slice(2, -2).trim();
    try {
      const value = resolveValue(path, { input, ...context.variables });
      return sanitizeValue(value);
    } catch (error: any) {
      console.error(`🚨 Erro ao resolver variável {{${path}}}:`, error.message);
      throw error; // Propagar erro de segurança
    }
  }

  return resolved;
}

/**
 * Lista de propriedades bloqueadas por segurança (prototype pollution)
 */
const BLOCKED_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/**
 * Resolve um caminho de propriedade (ex: "input.body.name" ou "$nodes.xxx.output")
 * @throws Error se tentar acessar propriedades perigosas
 */
function resolveValue(path: string, data: any, depth: number = 0): any {
  // Proteção contra recursão infinita
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    console.warn(`⚠️  Profundidade máxima atingida ao resolver: ${path}`);
    return undefined;
  }

  // Remove o $ inicial se existir (ex: $nodes -> nodes, $memory -> memory)
  const cleanPath = path.startsWith('$') ? path.substring(1) : path;

  const parts = cleanPath.split('.');
  let current = data;

  for (const part of parts) {
    // Bloquear acesso a propriedades perigosas
    if (BLOCKED_PROPERTIES.has(part)) {
      console.error(`🚨 Tentativa de acesso a propriedade bloqueada: ${part}`);
      throw new Error(
        `Acesso negado: propriedade "${part}" não pode ser acessada por segurança`,
      );
    }

    if (current === null || current === undefined) {
      return undefined;
    }

    // Validar que current é um objeto antes de acessar
    if (typeof current !== 'object') {
      console.warn(
        `⚠️  Tentativa de acessar propriedade "${part}" em tipo ${typeof current}`,
      );
      return undefined;
    }

    current = current[part];
  }

  return current;
}

/**
 * Exporta função para uso no webhook-worker
 */
export default executeDatabaseNode;
