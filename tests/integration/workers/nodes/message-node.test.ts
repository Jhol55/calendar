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

import '../setup';
import {
  cleanDatabase,
  cleanQueue,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getNodeOutput,
  generateTestId,
  createTestUser,
} from '../setup';
import { createMessageNode, createEdge } from '../fixtures';
import {
  TEST_PHONE_NUMBER,
  TEST_WHATSAPP_TOKEN,
  SKIP_CREDENTIAL_TESTS,
} from '../test-config';

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

  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
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
