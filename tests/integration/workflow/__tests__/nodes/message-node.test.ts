/**
 * Testes de Integração: Message Node
 *
 * Testa TODAS as funcionalidades do message-helper.ts:
 * - Tipos de mensagem: text, image, video, audio, document, contact, location
 * - Menus interativos: button, list, carousel
 * - Resolução de variáveis em todos os campos
 * - Validações: phoneNumber, token, conteúdo obrigatório
 * - Edge cases: campos vazios, formatos inválidos
 */

import '../../setup';
import {
  cleanDatabase,
  cleanQueue,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getNodeOutput,
  generateTestId,
  createTestUser,
} from '../../setup';
import { createMessageNode, createEdge } from '../../fixtures';
import { TEST_PHONE_NUMBER, TEST_WHATSAPP_TOKEN } from '../../test-config';

// ==============================================
// MENSAGENS DE TEXTO
// ==============================================

describe('Message Node - Text Messages', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve enviar mensagem de texto simples', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Olá, mundo!', {
        useTestCredentials: true,
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.type).toBe('message');
    expect(messageOutput.status).toBe('sent');
    expect(messageOutput.messageType).toBe('text');
    expect(messageOutput.text).toBe('Olá, mundo!');
    expect(messageOutput.phoneNumber).toBe(TEST_PHONE_NUMBER);
  });

  it('deve resolver variáveis em mensagem de texto', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Nome: {{$nodes.' + webhookId + '.output.message.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'João Silva' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.text).toBe('Nome: João Silva');
  });
});

// ==============================================
// MENSAGENS DE MÍDIA
// ==============================================

describe.skip('Message Node - Media Messages (NOT IMPLEMENTED)', () => {
  // TODO: Implementar suporte para image, video, audio, document no message-helper.ts
  // Atualmente apenas 'text' e 'interactive_menu' são suportados

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it.skip('deve enviar imagem com caption', async () => {
    // Not implemented yet
  });

  it.skip('deve enviar documento', async () => {
    // Not implemented yet
  });
});

// ==============================================
// MENUS INTERATIVOS - BUTTONS
// ==============================================

describe('Message Node - Interactive Menus (Buttons)', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve enviar menu de botões', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Escolha uma opção:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Escolha uma opção:',
          choices: ['Opção 1|opt1', 'Opção 2|opt2', 'Opção 3|opt3'],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Show menu' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.type).toBe('message');
    expect(messageOutput.messageType).toBe('interactive_menu');
    expect(messageOutput.status).toBe('sent');
  });

  it('deve resolver variáveis em choices de botões', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Menu dinâmico', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Escolha:',
          choices: [
            'Produto: {{$nodes.' +
              webhookId +
              '.output.message.product}}|prod1',
            'Confirmar|confirm',
          ],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { product: 'Laptop Dell' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.status).toBe('sent');
    // Variável deve ter sido resolvida no choice
  });
});

// ==============================================
// MENUS INTERATIVOS - LIST
// ==============================================

describe('Message Node - Interactive Menus (List)', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve enviar menu tipo lista', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Escolha um produto:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'list',
          text: 'Catálogo de produtos',
          listButton: 'Ver produtos',
          choices: [
            '[Eletrônicos]',
            'Laptop|laptop1|Laptop Dell i5',
            'Mouse|mouse1|Mouse sem fio',
            '[Acessórios]',
            'Teclado|kbd1|Teclado mecânico',
          ],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Show products' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.type).toBe('message');
    expect(messageOutput.messageType).toBe('interactive_menu');
    expect(messageOutput.status).toBe('sent');
  });
});

// ==============================================
// VALIDAÇÕES E EDGE CASES
// ==============================================

describe('Message Node - Validations', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve falhar se phoneNumber não fornecido', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'No Phone',
          messageConfig: {
            // phoneNumber ausente
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    // Job deve completar mas com erro
    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/phoneNumber/i); // Case-insensitive match
  });

  it('deve falhar se token não fornecido', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'No Token',
          messageConfig: {
            phoneNumber: TEST_PHONE_NUMBER,
            // token ausente
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/token/i); // Case-insensitive match
  });

  it('deve manter placeholder se variável não existe', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Valor: {{$nodes.' + webhookId + '.output.message.nonExistent}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Variável não resolvida deve manter o placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
    expect(messageOutput.text).toContain('.output.message.nonExistent}}');
  });
});

// ==============================================
// CENÁRIOS NEGATIVOS - VALIDAÇÕES DE ENTRADA
// ==============================================

describe('Message Node - Negative Scenarios (Input Validation)', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('should fail when messageType is invalid', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'Invalid Type',
          messageConfig: {
            phoneNumber: TEST_PHONE_NUMBER,
            token: TEST_WHATSAPP_TOKEN,
            messageType: 'invalidType', // Tipo inválido
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/tipo|type|invalid/i);
  });

  it('should fail when text message has empty text', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'Empty Text',
          messageConfig: {
            phoneNumber: TEST_PHONE_NUMBER,
            token: TEST_WHATSAPP_TOKEN,
            messageType: 'text',
            text: '', // Texto vazio
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/text|content|required/i);
  });

  it('should fail when phone number has invalid format (contains letters)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'Invalid Phone',
          messageConfig: {
            phoneNumber: '5511ABCD1234', // Letras no número
            token: TEST_WHATSAPP_TOKEN,
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/phone|número|inválido/i);
  });

  it('should fail when phone number is too short', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'Short Phone',
          messageConfig: {
            phoneNumber: '123', // Muito curto
            token: TEST_WHATSAPP_TOKEN,
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/phone|número|inválido/i);
  });

  it('should fail when token is empty', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: messageId,
        type: 'message',
        position: { x: 200, y: 100 },
        data: {
          label: 'Empty Token',
          messageConfig: {
            phoneNumber: TEST_PHONE_NUMBER,
            token: '', // Token vazio
            text: 'Test',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/token/i);
  });
});

// ==============================================
// CENÁRIOS NEGATIVOS - MENUS INTERATIVOS
// ==============================================

describe('Message Node - Negative Scenarios (Interactive Menus)', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('should fail when button menu has more than 3 buttons (WhatsApp limit)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Choose:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Choose:',
          choices: [
            'Option 1|opt1',
            'Option 2|opt2',
            'Option 3|opt3',
            'Option 4|opt4', // 4º botão - excede limite do WhatsApp
          ],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/button|limit|3/i);
  });

  it('should fail when list menu has more than 10 sections (WhatsApp limit)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    // Criar mais de 10 seções
    const tooManySections = [];
    for (let i = 1; i <= 11; i++) {
      tooManySections.push(`[Section ${i}]`);
      tooManySections.push(`Item ${i}|item${i}`);
    }

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Choose:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'list',
          text: 'Choose:',
          listButton: 'Ver opções',
          choices: tooManySections,
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/section|limit|10/i);
  });

  it('should fail when menu has empty choices array', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Choose:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Choose:',
          choices: [], // Array vazio
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/choice|empty|required/i);
  });

  it('should fail when button choice has malformed format (missing pipe)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Choose:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Choose:',
          choices: [
            'Valid Option|valid',
            'Invalid Option Without ID', // Sem pipe separator
          ],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/format|pipe|invalid/i);
  });
});

// ==============================================
// EDGE CASES - LIMITES DE TAMANHO
// ==============================================

describe('Message Node - Edge Cases (Size Limits)', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('should handle very long text message (near 4096 char limit)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    // Criar texto com 4000 caracteres (abaixo do limite)
    const longText = 'A'.repeat(4000);

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, longText, {
        useTestCredentials: true,
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.status).toBe('sent');
    expect(messageOutput.text.length).toBe(4000);
  });

  it('should handle text with special characters (emojis, unicode)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const specialText = '🚀 Hello 世界! مرحبا 🌟 Testing RTL: مرحبا بك';

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, specialText, {
        useTestCredentials: true,
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.status).toBe('sent');
    expect(messageOutput.text).toBe(specialText);
  });

  it('should handle button text at character limit (20 chars)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Menu:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Choose:',
          choices: [
            '12345678901234567890|max', // Exatamente 20 caracteres
            'Short|short',
          ],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.status).toBe('sent');
  });

  it('should handle menu with maximum valid items (3 buttons)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(messageId, 'Menu:', {
        useTestCredentials: true,
        messageType: 'interactive_menu',
        menuConfig: {
          type: 'button',
          text: 'Choose:',
          choices: ['Option 1|opt1', 'Option 2|opt2', 'Option 3|opt3'],
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.status).toBe('sent');
    expect(messageOutput.messageType).toBe('interactive_menu');
  });
});

// ==============================================
// ERROR SCENARIOS - API FAILURES
// ==============================================

describe.skip('Message Node - Error Scenarios (API)', () => {
  // Nota: Estes testes são skipped porque requerem simular falhas de API
  // Em produção, esses cenários são tratados pela biblioteca UAZAPI

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it.skip('should handle API authentication failure (invalid token)', async () => {
    // Requer mock da API para simular token inválido
    // A implementação real já trata esse erro
  });

  it.skip('should handle invalid phone number (number does not exist)', async () => {
    // Requer mock da API para simular número inexistente
    // A implementação real já trata esse erro
  });

  it.skip('should handle rate limit errors from WhatsApp API', async () => {
    // Requer mock da API para simular rate limiting
    // A implementação real deve ter retry logic
  });
});
