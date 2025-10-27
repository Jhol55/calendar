// ============================================
// NODE FACTORY FUNCTIONS
// ============================================
// Factory functions para criar nodes de teste
// Todas as funções de criação de nodes devem ficar aqui

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Webhook Node
 */
export function createWebhookNode(
  nodeId: string,
  config: Partial<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers: Record<string, string>;
    validatePayload: boolean;
  }> = {},
): any {
  return {
    id: nodeId,
    type: 'webhook',
    position: { x: 100, y: 100 },
    data: {
      label: 'Webhook Trigger',
      config: {
        method: 'POST',
        ...config,
      },
    },
  };
}

/**
 * Memory Node
 */
export function createMemoryNode(
  nodeId: string,
  operation: 'read' | 'write',
  key: string,
  value?: string,
): any {
  // Converter 'read'/'write' para 'fetch'/'save' (API do memory-helper)
  const action = operation === 'write' ? 'save' : 'fetch';

  return {
    id: nodeId,
    type: 'memory',
    position: { x: 600, y: 100 },
    data: {
      label: 'Memory Node',
      memoryConfig: {
        action,
        memoryName: 'test_memory', // Nome da memória (obrigatório)
        items: [
          {
            key, // Chave dentro da memória
            value: value || '{{$output}}', // Valor a ser salvo/buscado
          },
        ],
      },
    },
  };
}

/**
 * Database Node
 */
export function createDatabaseNode(nodeId: string, config: any = {}): any {
  return {
    id: nodeId,
    type: 'database',
    position: { x: 0, y: 0 },
    data: {
      label: 'Database Operation',
      databaseConfig: {
        operation: config.operation || 'get',
        tableName: config.table || config.tableName || 'test_table',
        filters: config.filters || [],
        data: config.data || {},
        sort: config.sort || [],
        limit: config.limit,
        ...config,
      },
    },
  };
}

/**
 * Condition Node
 */
export function createConditionNode(nodeId: string, config: any = {}): any {
  return {
    id: nodeId,
    type: 'condition',
    position: { x: 0, y: 0 },
    data: {
      label: 'Condition Check',
      conditionConfig: {
        conditionType: config.conditionType || 'if',
        rules:
          config.rules ||
          config.conditions?.map((c: any) => ({
            variable: c.field || c.variable,
            operator: c.operator,
            value: c.value,
            logicOperator: config.operator || 'AND',
          })) ||
          [],
        ...config,
      },
    },
  };
}

/**
 * Message Node
 */
export function createMessageNode(
  nodeId: string,
  text: string,
  options: {
    phoneNumber?: string;
    token?: string;
    messageType?: 'text' | 'interactive_menu';
    menuConfig?: any;
    useTestCredentials?: boolean;
  } = {},
): any {
  // Se useTestCredentials for true, usa as constantes de teste
  // Caso contrário, usa variáveis dinâmicas do webhook ou valores fornecidos
  const phoneNumber = options.useTestCredentials
    ? '{{TEST_PHONE_NUMBER}}'
    : options.phoneNumber || '{{$nodes.webhook.output.message.from}}';

  const token = options.useTestCredentials
    ? '{{TEST_WHATSAPP_TOKEN}}'
    : options.token || undefined;

  return {
    id: nodeId,
    type: 'message',
    position: { x: 100, y: 100 },
    data: {
      label: 'Message Node',
      messageConfig: {
        phoneNumber,
        token,
        text: text,
        messageType: options.messageType || 'text',
        ...(options.menuConfig && { interactiveMenu: options.menuConfig }),
      },
    },
  };
}

/**
 * HTTP Request Node
 */
export function createHttpRequestNode(
  nodeId: string,
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  config: any = {},
): any {
  return {
    id: nodeId,
    type: 'http-request',
    position: { x: 600, y: 600 },
    data: {
      label: 'HTTP Request',
      httpConfig: {
        url,
        method,
        headers: config.headers || {},
        body: config.body || {},
        timeout: config.timeout,
        ...config,
      },
    },
  };
}

/**
 * Transformation Node
 */
export function createTransformationNode(
  nodeId: string,
  transformationType: string,
  config: any = {},
): any {
  return {
    id: nodeId,
    type: 'transformation',
    position: { x: 700, y: 700 },
    data: {
      label: 'Transform Data',
      transformationConfig: {
        transformationType,
        script: config.script || '',
        mappings: config.mappings || {},
        ...config,
      },
    },
  };
}

/**
 * Code Execution Node
 */
export function createCodeExecutionNode(
  nodeId: string,
  code: string,
  language: 'javascript' | 'python' = 'javascript',
  inputVariables?: string,
  outputVariable?: string,
): any {
  return {
    id: nodeId,
    type: 'code_execution',
    position: { x: 500, y: 100 },
    data: {
      label: 'Code Execution Node',
      codeExecutionConfig: {
        code,
        language,
        inputVariables,
        outputVariable: outputVariable || 'codeResult',
      },
    },
  };
}

// ============================================
// HELPER FUNCTIONS FOR NODE CONFIGURATION
// ============================================

/**
 * Cria uma configuração de filtro para database node
 */
export function createDatabaseFilter(
  field: string,
  operator: string,
  value: any,
): any {
  return {
    field,
    operator,
    value,
  };
}

/**
 * Cria uma configuração de sort para database node
 */
export function createDatabaseSort(field: string, order: 'asc' | 'desc'): any {
  return {
    field,
    order,
  };
}

/**
 * Cria uma condição individual para condition node
 */
export function createCondition(
  field: string,
  operator: string,
  value: any,
): any {
  return {
    field,
    operator,
    value,
  };
}

/**
 * Operadores disponíveis para condições
 */
export const CONDITION_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  GREATER_THAN_OR_EQUAL: 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL: 'less_than_or_equal',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  IS_EMPTY: 'is_empty',
  IS_NOT_EMPTY: 'is_not_empty',
};
