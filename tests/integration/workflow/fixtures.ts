// ============================================
// FIXTURES PARA TESTES - APENAS DADOS ESTÁTICOS
// ============================================

/**
 * PAYLOADS DE WEBHOOK
 * Dados de exemplo para simular requisições webhook
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
 * MENU INTERATIVO FIXTURES
 * Configurações de exemplo para menus interativos
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
 * Exemplos de código para testes de code execution
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
 * Dados de exemplo para testes de database
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
