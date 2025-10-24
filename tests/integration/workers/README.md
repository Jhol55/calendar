# Testes de Integração - Workers

Estrutura de testes alinhada com a arquitetura do código em `src/workers/`.

## 📁 Estrutura

```
tests/integration/workers/
├── setup.ts                    # Setup compartilhado (DB, Queue, Helpers)
├── teardown.ts                 # Teardown global (fechar conexões)
├── fixtures.ts                 # Factories para criar nodes
├── test-config.ts              # Credenciais de teste
│
├── flow-execution.test.ts      # ✅ Core: executeFlow, processNodeChain
├── variables.test.ts           # ✅ Cross-node: resolução de {{$nodes.*}}
│
└── nodes/                      # 🎯 UM ARQUIVO POR TIPO DE NODE
    └── database-node.test.ts   # ✅ database-helper.ts

    # TODO: Criar arquivos para os demais nodes
    # ├── message-node.test.ts      # message-helper.ts
    # ├── memory-node.test.ts       # memory-helper.ts
    # ├── condition-node.test.ts    # condition-helper.ts
    # ├── http-request-node.test.ts # http-helper.ts
    # ├── agent-node.test.ts        # agent-helper.ts
    # ├── loop-node.test.ts         # loop-helper.ts
    # ├── code-execution-node.test.ts # code-execution-helper.ts
    # └── transformation-node.test.ts # transformation-helper.ts
```

## 🎯 Mapeamento: Código ↔ Testes

| Helper (src/workers/helpers/) | Test File (tests/integration/workers/nodes/) | Status      |
| ----------------------------- | -------------------------------------------- | ----------- |
| `database-helper.ts`          | `database-node.test.ts`                      | ✅ Completo |
| `message-helper.ts`           | `message-node.test.ts`                       | ⚠️ TODO     |
| `memory-helper.ts`            | `memory-node.test.ts`                        | ⚠️ TODO     |
| `condition-helper.ts`         | `condition-node.test.ts`                     | ⚠️ TODO     |
| `http-helper.ts`              | `http-request-node.test.ts`                  | ⚠️ TODO     |
| `agent-helper.ts`             | `agent-node.test.ts`                         | ⚠️ TODO     |
| `loop-helper.ts`              | `loop-node.test.ts`                          | ⚠️ TODO     |
| `code-execution-helper.ts`    | `code-execution-node.test.ts`                | ⚠️ TODO     |
| `transformation-helper.ts`    | `transformation-node.test.ts`                | ⚠️ TODO     |

## 📝 Template para Novos Testes

```typescript
/**
 * Testes de Integração: [NODE_TYPE] Node
 *
 * Testa funcionalidades do [helper-name].ts:
 * - [Funcionalidade 1]
 * - [Funcionalidade 2]
 * - Validações
 * - Edge cases
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
import { create[Node]Node, createEdge } from '../fixtures';

describe('[NodeType] Node', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  describe('Funcionalidade Principal', () => {
    it('deve [comportamento esperado]', async () => {
      // Arrange
      const webhookId = generateTestId('webhook');
      const nodeId = generateTestId('node');

      // Act
      const nodes = [
        createWebhookNode(webhookId),
        create[Node]Node(nodeId, /* config */),
      ];

      const edges = [createEdge('e1', webhookId, nodeId)];
      const flowId = await createTestFlow(nodes, edges);

      const { executionId } = await triggerAndWait(
        flowId,
        webhookId,
        { /* payload */ },
      );

      // Assert
      const output = await getNodeOutput(executionId, nodeId);
      expect(output).toMatchObject({ /* expected */ });
    });
  });

  describe('Validações', () => {
    it('deve rejeitar [cenário inválido]', async () => {
      // Test negative scenario
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com [caso limite]', async () => {
      // Test edge case
    });
  });
});
```

## ✅ Checklist de Cobertura

Para cada node, garantir:

- [ ] **Cenários Positivos**: Funcionalidade principal funcionando
- [ ] **Cenários Negativos**: Validações rejeitando entradas inválidas
- [ ] **Edge Cases**: Valores vazios, null, estruturas complexas
- [ ] **Variáveis**: Resolução de `{{$nodes.*}}` em configurações

## 🚀 Como Executar

```bash
# Todos os testes de workers
npm run test:integration

# Apenas database node
npm test nodes/database-node

# Apenas variables (cross-node)
npm test variables.test

# Apenas flow execution (core)
npm test flow-execution
```

## 📊 Cobertura Atual

- ✅ **Flow Execution**: 100% (core completo)
- ✅ **Database Node**: 100% (CRUD + tipos + validações + edge cases)
- ⚠️ **Variables (Cross-node)**: 50% (3/6 testes passando)
- ❌ **Demais Nodes**: 0% (arquivos não criados)

---

**Última atualização**: Reorganização completa - Database Node mesclado com JSON Parsing
