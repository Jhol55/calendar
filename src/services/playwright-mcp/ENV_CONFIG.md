# Playwright MCP - Configuração de Variáveis de Ambiente

Este documento descreve as variáveis de ambiente para configurar o sistema de Pool, Queue e Timeout do Playwright MCP.

## Variáveis de Ambiente

Adicione estas variáveis ao seu arquivo `.env`:

```bash
# Playwright MCP - Browser Pool & Queue Configuration
# ====================================================

# Browser Pool - Máximo de browsers no pool (lazy loading)
# Browsers são criados sob demanda até atingir este limite
# Valor recomendado: 10-20 (cada browser consome ~100-200MB RAM)
MAX_POOL_SIZE=10

# Browser Max Age - Tempo máximo que um browser pode ficar inativo no pool (em ms)
# Após este tempo, browsers inativos são fechados para liberar memória
# Valor: 3600000 = 1 hora
BROWSER_MAX_AGE_MS=3600000

# Execution Queue - Máximo de execuções simultâneas
# Limita quantas tarefas Playwright podem rodar ao mesmo tempo
# Requisições excedentes vão para fila de espera
# Valor recomendado: 10-15
MAX_CONCURRENT_EXECUTIONS=10

# Queue Max Size - Tamanho máximo da fila de espera
# Se a fila encher, novas requisições serão rejeitadas
# Valor recomendado: 50-100
QUEUE_MAX_SIZE=50

# Execution Timeout - Tempo máximo por execução (em ms)
# Previne browsers "zumbis" travando recursos indefinidamente
# Valor: 300000 = 5 minutos
EXECUTION_TIMEOUT_MS=300000
```

## Guia de Configuração por Cenário

### Desenvolvimento Local

```bash
MAX_POOL_SIZE=3
MAX_CONCURRENT_EXECUTIONS=3
EXECUTION_TIMEOUT_MS=600000  # 10min para debug
BROWSER_MAX_AGE_MS=1800000   # 30min
QUEUE_MAX_SIZE=10
```

### Produção - Servidor Pequeno (2GB RAM)

```bash
MAX_POOL_SIZE=5
MAX_CONCURRENT_EXECUTIONS=5
EXECUTION_TIMEOUT_MS=300000  # 5min
BROWSER_MAX_AGE_MS=3600000   # 1h
QUEUE_MAX_SIZE=25
```

### Produção - Servidor Médio (4GB RAM)

```bash
MAX_POOL_SIZE=10
MAX_CONCURRENT_EXECUTIONS=10
EXECUTION_TIMEOUT_MS=300000  # 5min
BROWSER_MAX_AGE_MS=3600000   # 1h
QUEUE_MAX_SIZE=50
```

### Produção - Servidor Grande (8GB+ RAM)

```bash
MAX_POOL_SIZE=20
MAX_CONCURRENT_EXECUTIONS=20
EXECUTION_TIMEOUT_MS=300000  # 5min
BROWSER_MAX_AGE_MS=3600000   # 1h
QUEUE_MAX_SIZE=100
```

## Como Usar

### 1. API Recomendada (com Pool + Queue + Timeout)

```typescript
import { runPlaywrightTask } from '@/services/playwright-mcp';

const result = await runPlaywrightTask({
  goal: 'Navegar e extrair dados',
  steps: [...],
  context: { headless: true }
});
```

**Benefícios:**

- ✅ Limite de concorrência automático
- ✅ Reuso de browsers (menor latência)
- ✅ Timeout automático (5min)
- ✅ Fila quando limite atingido

### 2. API Direta (sem fila, para debug)

```typescript
import { runPlaywrightTaskDirect } from '@/services/playwright-mcp';

const result = await runPlaywrightTaskDirect({
  goal: 'Debug visual',
  steps: [...],
  context: { headless: false }  // Ver browser aberto
});
```

**Use quando:**

- 🔍 Debug visual (headless=false)
- 🧪 Testes/desenvolvimento
- ⚡ Não pode esperar na fila

### 3. Estatísticas do Sistema

```typescript
import { getPlaywrightStats } from '@/services/playwright-mcp';

const stats = getPlaywrightStats();
console.log(stats);
// {
//   pool: { total: 5, inUse: 3, available: 2, maxSize: 10 },
//   queue: { queueSize: 2, running: 10, maxConcurrent: 10 }
// }
```

## Monitoramento

### Sinais de que precisa ajustar configurações:

**Fila crescendo muito:**

- ↑ Aumentar `MAX_CONCURRENT_EXECUTIONS`
- ↑ Aumentar `MAX_POOL_SIZE`

**Servidor ficando sem memória:**

- ↓ Diminuir `MAX_POOL_SIZE`
- ↓ Diminuir `MAX_CONCURRENT_EXECUTIONS`
- ↓ Diminuir `BROWSER_MAX_AGE_MS` (fecha browsers mais rápido)

**Muitos timeouts:**

- ↑ Aumentar `EXECUTION_TIMEOUT_MS`
- Ou otimizar as tarefas para serem mais rápidas

**Requisições rejeitadas (fila cheia):**

- ↑ Aumentar `QUEUE_MAX_SIZE`
- ↑ Aumentar `MAX_CONCURRENT_EXECUTIONS`

## Cálculo de Memória

**Estimativa de uso de RAM:**

```
Memória Base (Node.js) = ~500MB
Cada Browser = ~150MB
Total = 500MB + (MAX_POOL_SIZE × 150MB)

Exemplos:
- MAX_POOL_SIZE=5  → ~1.25GB RAM
- MAX_POOL_SIZE=10 → ~2GB RAM
- MAX_POOL_SIZE=20 → ~3.5GB RAM
```

**Recomendação:** Deixe pelo menos 1GB livre para o sistema operacional e outros processos.

## Valores Padrão (se não definir)

Se não definir as variáveis, estes valores serão usados:

- `MAX_POOL_SIZE=10`
- `BROWSER_MAX_AGE_MS=3600000` (1 hora)
- `MAX_CONCURRENT_EXECUTIONS=10`
- `QUEUE_MAX_SIZE=50`
- `EXECUTION_TIMEOUT_MS=300000` (5 minutos)
