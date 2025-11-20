# Migração para Better-Playwright-MCP Mantendo Componente React

## ✅ Resposta: SIM, podemos manter a mesma lógica!

O componente React `playwright-mcp-node-config.tsx` **NÃO precisa ser alterado**. A migração acontece apenas no backend.

---

## 📊 Fluxo Atual

```
┌─────────────────────────────────────┐
│ playwright-mcp-node-config.tsx      │
│ (Componente React - UI)             │
│                                     │
│ Cria: PlaywrightMcpConfig           │
│ - goal, startUrl, mode, steps...   │
└──────────────┬──────────────────────┘
               │ onSave(config)
               ▼
┌─────────────────────────────────────┐
│ node.data.playwrightMcpConfig      │
│ (Armazenado no banco)               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ processPlaywrightMcpNode()          │
│ (flow-executor.ts)                  │
│                                     │
│ Transforma:                         │
│ PlaywrightMcpConfig →               │
│ WebscraperMcpStep[]                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ runWebscraperMcpTask()              │
│ (webscraper-mcp.service.ts)         │
│                                     │
│ Switch:                             │
│ - USE_BETTER_PLAYWRIGHT=true?       │
│   → better-playwright.service.ts    │
│ - Senão                             │
│   → Backend Python                  │
└─────────────────────────────────────┘
```

---

## 🎯 O Que Precisa Ser Feito

### 1. ✅ Componente React - SEM MUDANÇAS

O componente `playwright-mcp-node-config.tsx` já está perfeito:

- ✅ Interface `PlaywrightMcpConfig` correta
- ✅ Suporta `steps` com `mode: 'guided' | 'automatic'`
- ✅ Suporta ações guiadas e prompts automáticos
- ✅ Validação e UI completa

**Não precisa alterar nada!**

### 2. ⚠️ Backend - Completar Integração

O `better-playwright.service.ts` precisa:

#### A. Completar Modo Automático

## 🤔 Por Que Precisa "Implementar" se Já é MCP?

**Boa pergunta!** A confusão é que o better-playwright-mcp tem **DUAS formas de uso**:

### 1. **PlaywrightClient** (HTTP API) - SEM IA

```typescript
// O que está sendo usado AGORA no serviço
const client = new PlaywrightClient('http://localhost:3102');
await client.click(pageId, 'e1'); // Você decide qual ação
await client.type(pageId, 'e2', 'texto'); // Você decide qual ação
```

- ✅ Fornece ferramentas (click, type, navigate, etc.)
- ❌ **NÃO tem IA** - você precisa decidir qual ferramenta usar
- ✅ Perfeito para modo **guiado** (ações determinísticas)

### 2. **Context.runTask()** (Loop Autônomo) - COM IA

```typescript
// O que precisa ser usado para modo AUTOMÁTICO
const ctx = await Context.create({});
await ctx.runTask('Faça login no site X'); // IA decide quais ações fazer!
```

- ✅ **TEM IA integrada** (OpenAI/Anthropic)
- ✅ IA decide automaticamente quais ferramentas usar
- ✅ Loop iterativo até completar a tarefa
- ✅ Perfeito para modo **automático** (IA navega sozinha)

### A Diferença:

| Aspecto                | PlaywrightClient        | Context.runTask()       |
| ---------------------- | ----------------------- | ----------------------- |
| **Tem IA?**            | ❌ Não                  | ✅ Sim                  |
| **Quem decide ações?** | Você (código)           | IA                      |
| **Uso**                | Modo guiado             | Modo automático         |
| **Como funciona**      | `client.click()` direto | `ctx.runTask('tarefa')` |

### Por Que Precisa "Implementar"?

O serviço atual (`better-playwright.service.ts`) só usa `PlaywrightClient`:

```typescript
// ❌ Atual - SEM IA
const client = new PlaywrightClient(...);
await client.click(...);  // Você decide
```

Para modo automático, precisa usar `Context.runTask()`:

```typescript
// ✅ Necessário - COM IA
const ctx = await Context.create({});
await ctx.runTask(step.description); // IA decide!
```

**É só trocar de API, não criar IA do zero!** A IA já está implementada no `Context.runTask()`.

---

## 💡 Solução: Usar `Context.runTask()` para Modo Automático

**Solução:** Usar `Context.runTask()` do better-playwright-mcp:

```typescript
import { Context } from 'better-playwright-mcp3/lib/loopTools/context.js';

if (step.mode === 'automatic') {
  // Criar contexto com IA
  const ctx = await Context.create({
    headless: true,
    // outras configs
  });

  try {
    // Construir tarefa a partir do prompt/description
    const task = step.description || step.prompt || input.goal;

    // IA navega sozinha!
    const result = await ctx.runTask(task);

    // Extrair resposta
    finalAnswer = extractAnswerFromResult(result);
    logs.push(`✅ [AUTO] Tarefa completada pela IA`);
  } finally {
    await ctx.close();
  }
}
```

#### B. Completar Mapeamento de Ações

Adicionar ações faltantes no `executeAction()`:

```typescript
async function executeAction(
  client: PlaywrightClient,
  pageId: string,
  action: WebscraperMcpStepAction,
  logs: string[],
): Promise<void> {
  try {
    switch (action.action) {
      // ✅ Já implementadas
      case 'goto_url':
        /* ... */ break;
      case 'click':
        /* ... */ break;
      case 'type':
        /* ... */ break;
      case 'hover':
        /* ... */ break;
      case 'scroll_down':
        /* ... */ break;
      case 'scroll_up':
        /* ... */ break;
      case 'wait':
        /* ... */ break;

      // ❌ Faltam implementar
      case 'double_click':
        // TODO: Adicionar método no cliente ou simular
        break;

      case 'type_and_submit':
        // Combinar type + press Enter
        if (action.selector && action.text) {
          await client.type(pageId, action.selector, action.text);
          await client.pressKey(pageId, 'Enter');
        }
        break;

      case 'switch_to_iframe':
        // TODO: Adicionar suporte a iframes
        break;

      case 'select_option_by_text':
      case 'select_option_by_value':
        // TODO: Usar browserSelectOption
        break;

      // ... outras ações
    }
  } catch (error) {
    // ...
  }
}
```

#### C. Usar Seletores CSS/XPath Diretamente (MODO GUIADO)

**Por que precisa?** Por causa do **modo guiado**!

### O Problema:

1. **Modo Guiado**: Componente React envia ações com seletores CSS/XPath:

   ```typescript
   {
     action: 'click',
     selector: '#meu-botao',        // ← CSS do componente
     selectorType: 'css'
   }
   ```

2. **PlaywrightClient HTTP**: Só aceita refs:

   ```typescript
   await client.click(pageId, 'e1'); // ❌ Precisa ref, não CSS!
   ```

3. **Modo Automático**: Não precisa! Usa `Context.runTask()` e a IA decide tudo.

### A Solução:

Para **modo guiado**, usar Playwright diretamente (bypass do HTTP API) para aceitar os seletores CSS/XPath que vêm do componente React.

O `better-playwright-mcp` usa refs na API HTTP, mas o **Playwright nativo** (que está por baixo) aceita seletores CSS/XPath diretamente via `page.locator(selector)`.

**Solução:** Modificar o serviço para usar Playwright diretamente quando receber seletores CSS/XPath:

```typescript
import { chromium } from 'playwright';

// Opção 1: Usar Playwright diretamente (mais simples)
async function executeActionWithSelector(
  page: Page, // Página do Playwright
  action: WebscraperMcpStepAction,
  logs: string[],
): Promise<void> {
  const selector = buildSelector(action.selector, action.selectorType);

  switch (action.action) {
    case 'click':
      await page.locator(selector).click();
      break;
    case 'type':
      await page.locator(selector).type(action.text || '');
      break;
    // ... outras ações
  }
}

function buildSelector(selector: string, selectorType?: string): string {
  if (!selectorType || selectorType === 'css') {
    return selector; // CSS direto
  }
  if (selectorType === 'xpath') {
    return `xpath=${selector}`; // XPath com prefixo
  }
  if (selectorType === 'tag_name') {
    return selector; // Tag name direto
  }
  return selector;
}
```

**Ou:** Modificar o servidor HTTP do better-playwright-mcp para aceitar seletores diretamente (mais trabalho, mas mantém arquitetura).

**Recomendação:** Usar Playwright diretamente no serviço TypeScript - mais simples e direto!

---

## 🔄 Compatibilidade de Formatos

### Formato do Componente React

```typescript
interface PlaywrightMcpConfig {
  goal: string;
  startUrl?: string;
  mode?: 'autonomous' | 'guided' | 'hybrid';
  steps?: WebscraperStep[];
}

interface WebscraperStep {
  id: string;
  mode: 'guided' | 'automatic';
  url?: string;
  description?: string;
  prompt?: string | null;
  actions?: WebscraperStepAction[];
}

interface WebscraperStepAction {
  action: 'click' | 'type' | 'goto_url' | ...;
  selectorType?: 'css' | 'xpath' | 'tag_name';
  selector?: string | null;
  text?: string | null;
}
```

### Formato Esperado pelo Backend

```typescript
interface WebscraperMcpTaskInput {
  executionId: string;
  goal: string;
  steps: WebscraperMcpStep[];
}

interface WebscraperMcpStep {
  mode?: 'guided' | 'automatic';
  url?: string | null;
  description?: string | null;
  actions?: WebscraperMcpStepAction[];
}
```

**✅ Compatível!** O `processPlaywrightMcpNode` já faz a transformação corretamente.

---

## 🚀 Plano de Implementação

### Fase 1: Integrar Modo Automático (1 semana)

1. ✅ Importar `Context` do better-playwright-mcp
2. ✅ Implementar `runAutomaticStep()` usando `Context.runTask()`
3. ✅ Configurar variáveis de ambiente (OPENAI_API_KEY ou ANTHROPIC_API_KEY)
4. ✅ Testar com etapas automáticas

### Fase 2: Completar Ações (1 semana)

1. ✅ Implementar ações faltantes
2. ✅ Adicionar conversão de seletores para refs
3. ✅ Testar todas as ações do componente

### Fase 3: Modo Híbrido (Opcional - 1 semana)

1. ✅ Adicionar suporte a `mode: 'hybrid'`
2. ✅ Implementar lógica de execução híbrida
3. ✅ Atualizar componente para suportar modo híbrido (se necessário)

---

## 📝 Exemplo de Código Completo

### better-playwright.service.ts (Atualizado)

```typescript
import { PlaywrightClient } from 'better-playwright-mcp3';
import { Context } from 'better-playwright-mcp3/lib/loopTools/context.js';
import {
  WebscraperMcpTaskInput,
  WebscraperMcpTaskResult,
  WebscraperMcpStep,
} from '../webscraper-mcp.service';

export async function runBetterPlaywrightMcpTask(
  input: WebscraperMcpTaskInput,
): Promise<WebscraperMcpTaskResult> {
  const logs: string[] = [];
  let finalAnswer: any = null;

  try {
    logs.push(`🧱 Etapas recebidas: ${input.steps.length}`);

    // Processar cada etapa
    for (let idx = 0; idx < input.steps.length; idx++) {
      const step = input.steps[idx];
      logs.push(
        `➡️ Etapa ${idx + 1}/${input.steps.length} - mode=${step.mode}`,
      );

      if (step.mode === 'automatic') {
        // ✅ MODO AUTOMÁTICO - IA navega sozinha
        const ctx = await Context.create({
          headless: true,
        });

        try {
          const task = step.description || input.goal;
          logs.push(`🤖 [AUTO] Executando tarefa: ${task}`);

          const result = await ctx.runTask(task);
          finalAnswer = extractAnswerFromResult(result);

          logs.push(`✅ [AUTO] Tarefa completada pela IA`);
        } finally {
          await ctx.close();
        }
      } else {
        // ✅ MODO GUIADO - Executar ações fornecidas
        const client = new PlaywrightClient(PLAYWRIGHT_MCP_SERVER_URL);
        let pageId: string | null = null;

        try {
          // Criar página se necessário
          if (idx === 0 || step.url) {
            const pageResult = await client.createPage(
              input.profile || `execution_${input.executionId}`,
              input.goal || 'Web scraping task',
              step.url || 'about:blank',
            );
            pageId = pageResult.pageId;
          }

          // Executar ações
          if (step.actions) {
            for (const action of step.actions) {
              await executeAction(client, pageId!, action, logs);
            }
          }
        } finally {
          if (pageId) {
            await client.closePage(pageId);
          }
        }
      }
    }

    return {
      success: true,
      message: 'Tarefa executada com sucesso',
      data: {
        answer: finalAnswer,
      },
      logs,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    logs.push(`❌ Erro: ${errorMessage}`);

    return {
      success: false,
      error: true,
      message: errorMessage,
      logs,
    };
  }
}

function extractAnswerFromResult(result: any): string | null {
  // Extrair resposta do resultado do Context.runTask()
  // O formato depende do que a IA retornar
  if (result?.content) {
    return result.content[0]?.text || null;
  }
  return null;
}
```

---

## ✅ Checklist de Migração

- [ ] **Componente React**: Nenhuma mudança necessária ✅
- [ ] **Modo Automático**: Integrar `Context.runTask()`
- [ ] **Ações Faltantes**: Implementar todas as ações
- [ ] **Conversão de Seletores**: CSS/XPath → Refs
- [ ] **Variáveis de Ambiente**: Configurar OPENAI_API_KEY ou ANTHROPIC_API_KEY
- [ ] **Testes**: Validar modo guiado e automático
- [ ] **Modo Híbrido**: Implementar (opcional)

---

## 🎉 Conclusão

**SIM, podemos manter a mesma lógica do componente React!**

A migração é **transparente** para o frontend. Tudo acontece no backend:

1. Componente React continua igual ✅
2. Backend processa a mesma estrutura de dados ✅
3. Better-playwright-mcp recebe o formato compatível ✅

**Tempo estimado:** 2-3 semanas para implementação completa.
