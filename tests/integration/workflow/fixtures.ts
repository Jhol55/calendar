// ============================================
// FIXTURES PARA TESTES DE WEBHOOK WORKER
// ============================================

import { TEST_WHATSAPP_TOKEN, TEST_PHONE_NUMBER } from './test-config';

/**
 * PAYLOADS DE WEBHOOK
 */

export const webhookPayloads = {
  // Payload simples com texto
  simple: {
    message: {
      text: 'Olá!',
      from: '+5519971302477',
    },
  },

  // Payload com objeto aninhado
  nested: {
    message: {
      text: 'Pedido #123',
      from: '+5519971302477',
      metadata: {
        orderId: '123',
        items: [
          { id: '1', name: 'Produto A', price: 10.5 },
          { id: '2', name: 'Produto B', price: 20.75 },
        ],
      },
    },
  },

  // Payload com JSON string (para testar parseJSONRecursively)
  withJsonString: {
    message: {
      text: 'Dados do produto',
      from: '+5519971302477',
      productData:
        '[{"id":"1","name":"Produto A"},{"id":"2","name":"Produto B"}]',
    },
  },

  // Payload com button/list response
  buttonResponse: {
    message: {
      text: 'Button clicked',
      from: '+5519971302477',
      buttonOrListid: 'btn_confirm',
    },
  },

  // Payload com array
  arrayPayload: {
    message: {
      text: 'Lista de IDs',
      from: '+5519971302477',
      ids: [1, 2, 3, 4, 5],
    },
  },
};

/**
 * NODE FACTORIES
 */

export function createMessageNode(
  nodeId: string,
  text: string,
  options: {
    phoneNumber?: string;
    token?: string;
    messageType?: 'text' | 'interactive_menu';
    menuConfig?: any;
    useTestCredentials?: boolean; // Se true, usa credenciais de test-config.ts
  } = {},
): any {
  // Se useTestCredentials for true, usa as constantes de teste
  // Caso contrário, usa variáveis dinâmicas do webhook ou valores fornecidos
  const phoneNumber = options.useTestCredentials
    ? TEST_PHONE_NUMBER
    : options.phoneNumber || '{{$nodes.webhook.output.message.from}}';

  const token = options.useTestCredentials
    ? TEST_WHATSAPP_TOKEN
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

export function createConditionNode(
  nodeId: string,
  conditionType: 'if' | 'switch',
  config: any,
): any {
  return {
    id: nodeId,
    type: 'condition',
    position: { x: 200, y: 100 },
    data: {
      label: 'Condition Node',
      conditionConfig: {
        conditionType,
        ...config,
      },
    },
  };
}

export function createDatabaseNode(
  nodeId: string,
  operation: 'get' | 'insert' | 'update' | 'delete',
  tableName: string,
  config: any = {},
): any {
  return {
    id: nodeId,
    type: 'database',
    position: { x: 300, y: 100 },
    data: {
      label: 'Database Node',
      databaseConfig: {
        operation,
        tableName,
        ...config,
      },
    },
  };
}

export function createHttpRequestNode(
  nodeId: string,
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  config: any = {},
): any {
  return {
    id: nodeId,
    type: 'http_request',
    position: { x: 400, y: 100 },
    data: {
      label: 'HTTP Request Node',
      httpRequestConfig: {
        url,
        method,
        ...config,
      },
    },
  };
}

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

export function createTransformationNode(
  nodeId: string,
  transformationType: string,
  config: any = {},
): any {
  return {
    id: nodeId,
    type: 'transformation',
    position: { x: 700, y: 100 },
    data: {
      label: 'Transformation Node',
      transformationConfig: {
        transformationType,
        ...config,
      },
    },
  };
}

/**
 * EDGE FACTORIES
 */

export function createEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
): any {
  return {
    id,
    source,
    target,
    ...(sourceHandle && { sourceHandle }),
  };
}

/**
 * FLUXOS PRÉ-CONFIGURADOS
 */

export function simpleFlow(
  webhookNodeId: string,
  messageNodeId: string,
  options: { useTestCredentials?: boolean } = { useTestCredentials: true },
) {
  return {
    nodes: [
      {
        id: webhookNodeId,
        type: 'webhook',
        position: { x: 0, y: 0 },
        data: { label: 'Webhook' },
      },
      createMessageNode(
        messageNodeId,
        'Recebido: {{$nodes.' + webhookNodeId + '.output.message.text}}',
        { useTestCredentials: options.useTestCredentials },
      ),
    ],
    edges: [createEdge('e1', webhookNodeId, messageNodeId)],
  };
}

export function conditionFlow(
  webhookNodeId: string,
  conditionNodeId: string,
  messageTrueId: string,
  messageFalseId: string,
  options: { useTestCredentials?: boolean } = { useTestCredentials: true },
) {
  return {
    nodes: [
      {
        id: webhookNodeId,
        type: 'webhook',
        position: { x: 0, y: 0 },
        data: { label: 'Webhook' },
      },
      createConditionNode(conditionNodeId, 'if', {
        variable: '{{$nodes.' + webhookNodeId + '.output.message.text}}',
        operator: 'equals',
        value: 'sim',
      }),
      createMessageNode(messageTrueId, 'Você disse SIM!', {
        useTestCredentials: options.useTestCredentials,
      }),
      createMessageNode(messageFalseId, 'Você disse NÃO!', {
        useTestCredentials: options.useTestCredentials,
      }),
    ],
    edges: [
      createEdge('e1', webhookNodeId, conditionNodeId),
      createEdge('e2', conditionNodeId, messageTrueId, 'true'),
      createEdge('e3', conditionNodeId, messageFalseId, 'false'),
    ],
  };
}

export function databaseFlow(
  webhookNodeId: string,
  dbNodeId: string,
  messageNodeId: string,
  userId: number,
  tableName: string,
  options: { useTestCredentials?: boolean } = { useTestCredentials: true },
) {
  return {
    nodes: [
      {
        id: webhookNodeId,
        type: 'webhook',
        position: { x: 0, y: 0 },
        data: { label: 'Webhook' },
      },
      createDatabaseNode(dbNodeId, 'get', tableName, {
        filters: [],
        userId: userId,
      }),
      createMessageNode(
        messageNodeId,
        'Total: {{$nodes.' + dbNodeId + '.output.count}} registros',
        { useTestCredentials: options.useTestCredentials },
      ),
    ],
    edges: [
      createEdge('e1', webhookNodeId, dbNodeId),
      createEdge('e2', dbNodeId, messageNodeId),
    ],
  };
}

/**
 * MENU INTERATIVO FIXTURES
 */

export const menuFixtures = {
  // Menu list simples
  simpleList: {
    type: 'list',
    text: 'Escolha uma opção:',
    choices: [
      '[Categoria 1]',
      'Opção A|opt_a|Descrição A',
      'Opção B|opt_b|Descrição B',
    ],
    listButton: 'Menu',
  },

  // Menu list com variável (JSON parseado)
  listWithVariable: (nodeId: string) => ({
    type: 'list',
    text: 'Escolha um produto:',
    choices: ['{{$nodes.' + nodeId + '.output.menuData}}'],
    listButton: 'Produtos',
  }),

  // Menu carousel
  simpleCarousel: {
    type: 'carousel',
    text: 'Veja nossos produtos:',
    choices: [
      '[Produto 1\nDescrição do produto 1]',
      '{https://example.com/image1.jpg}',
      'Comprar|buy_1',
      '[Produto 2\nDescrição do produto 2]',
      '{https://example.com/image2.jpg}',
      'Comprar|buy_2',
    ],
  },
};

/**
 * CODE EXECUTION FIXTURES
 */

export const codeFixtures = {
  // JavaScript simples
  simpleJS: `
const result = 1 + 1;
console.log(result);
`,

  // JavaScript com input variables
  jsWithInput: `
const { produto, quantidade } = inputVars;
const total = produto.valor * quantidade;
console.log(JSON.stringify({ total, produto: produto.nome }));
`,

  // Python simples
  simplePython: `
result = 1 + 1
print(result)
`,

  // Python com input
  pythonWithInput: `
import json
produto = input_vars['produto']
quantidade = input_vars['quantidade']
total = float(produto['valor']) * quantidade
print(json.dumps({'total': total, 'produto': produto['nome']}))
`,
};

/**
 * DATABASE FIXTURES
 */

export function createDatabaseRecords(
  tableName: string,
  userId: number,
  count: number = 3,
) {
  return Array.from({ length: count }, (_, i) => ({
    tableName,
    userId,
    data: {
      id: `record_${i + 1}`,
      name: `Record ${i + 1}`,
      value: (i + 1) * 10,
      metadata: JSON.stringify({ index: i, category: 'test' }),
    },
  }));
}
