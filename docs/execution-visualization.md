# Visualização de Execuções do Fluxo

## Visão Geral

O sistema permite visualizar o caminho percorrido por uma execução específica do fluxo, destacando os nós executados e mostrando os dados de entrada e saída de cada nó.

## Como Usar

### 1. Acessar o Painel de Execuções

1. Abra um fluxo no editor
2. Clique no botão **"Execuções"** no painel superior direito
3. Uma lista com o histórico de execuções será exibida

### 2. Selecionar uma Execução

1. Clique em qualquer execução da lista
2. A execução será selecionada (borda azul)
3. Um botão **"🔍 Visualizar no Fluxo"** aparecerá

### 3. Visualizar no Fluxo

1. Clique em **"Visualizar no Fluxo"**
2. O painel fecha e volta para o editor
3. Os nós executados serão destacados com cores:
   - 🟢 **Verde** - Nó executado com sucesso
   - 🔴 **Vermelho** - Nó com erro
   - 🔵 **Azul** - Nó em execução

### 4. Ver Dados de Entrada/Saída

1. Dê duplo clique em qualquer nó executado
2. Os painéis laterais mostrarão:
   - **Esquerda**: Dados de entrada do nó
   - **Direita**: Dados de saída do nó

## Recursos

### ✅ Destaques Visuais

- **Box-shadow colorido** ao redor dos nós executados
- **Indicadores de status** visuais
- **Caminho percorrido** destacado no fluxo

### 📊 Informações Disponíveis

#### No Painel de Execuções:

- ID da execução
- Status (success, error, running)
- Data/hora de início e fim
- Duração
- Tipo de gatilho (webhook, manual, schedule)

#### Nos Painéis Laterais:

- **Entrada**: Dados recebidos pelo nó
- **Saída**: Resultado da execução do nó
- **Variáveis**: Copiar variáveis usadas

## Exemplos de Uso

### Caso 1: Debugar Fluxo com Erro

```
1. Abrir painel de execuções
2. Identificar execução com erro (❌ vermelho)
3. Clicar em "Visualizar no Fluxo"
4. Ver qual nó falhou (destacado em vermelho)
5. Dar duplo clique no nó
6. Verificar dados de entrada e erro na saída
```

### Caso 2: Validar Dados de Variáveis

```
1. Selecionar execução bem-sucedida
2. Visualizar no fluxo
3. Abrir nó de mensagem
4. Ver painel de entrada com dados do webhook
5. Ver painel de saída com mensagem enviada
6. Validar se variáveis foram substituídas corretamente
```

### Caso 3: Entender Fluxo Complexo

```
1. Executar fluxo com múltiplos nós
2. Visualizar execução
3. Ver caminho percorrido (nós destacados)
4. Identificar quais condições foram atendidas
5. Ver dados que fluíram entre nós
```

## Detalhes Técnicos

### SessionStorage

A execução selecionada é armazenada no `sessionStorage`:

```typescript
sessionStorage.setItem('selectedExecution', JSON.stringify(execution));
```

Isso permite que os painéis laterais carreguem os dados corretos.

### Destaque de Nós

Os nós são atualizados com:

```typescript
{
  data: {
    ...node.data,
    executionStatus: 'completed' | 'error' | 'running'
  },
  style: {
    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.5)' // Verde para sucesso
  }
}
```

### Dados de Execução

Cada nó executado tem:

```typescript
{
  nodeId: string;
  status: 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  data: unknown;      // Entrada
  result: unknown;    // Saída
  error?: string;
}
```

## Fluxo de Dados

```
┌─────────────────────┐
│ Usuário clica em    │
│ "Execuções"         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Lista de execuções  │
│ é carregada         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Usuário seleciona   │
│ uma execução        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Clica "Visualizar   │
│ no Fluxo"           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Execução salva no   │
│ sessionStorage      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Nós destacados no   │
│ editor com cores    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Usuário abre nó     │
│ (duplo clique)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Painéis laterais    │
│ mostram dados       │
└─────────────────────┘
```

## Cores e Status

### Status das Execuções

| Status  | Cor      | Ícone | Descrição                       |
| ------- | -------- | ----- | ------------------------------- |
| success | Verde    | ✓     | Execução completada com sucesso |
| error   | Vermelho | ✗     | Execução falhou com erro        |
| running | Azul     | ⟳     | Execução em andamento           |
| stopped | Cinza    | ■     | Execução foi parada             |

### Destaque no Flow

| Status    | Box Shadow                                    |
| --------- | --------------------------------------------- |
| completed | `0 0 0 3px rgba(34, 197, 94, 0.5)` (verde)    |
| error     | `0 0 0 3px rgba(239, 68, 68, 0.5)` (vermelho) |
| running   | `0 0 0 3px rgba(59, 130, 246, 0.5)` (azul)    |

## Limitações Atuais

- ⚠️ Apenas uma execução pode ser visualizada por vez
- ⚠️ O destaque é limpo ao recarregar a página
- ⚠️ Não mostra animação do caminho percorrido (futuro)

## Próximas Funcionalidades

- [ ] Animação mostrando o caminho passo a passo
- [ ] Timeline de execução dos nós
- [ ] Comparar duas execuções
- [ ] Exportar dados de execução
- [ ] Replay de execução
- [ ] Estatísticas de execução (tempo médio, taxa de sucesso)

## Boas Práticas

### ✅ Faça

- Use para debugar fluxos com erro
- Valide dados de variáveis após execução
- Acompanhe o caminho em fluxos complexos
- Verifique se todas as condições funcionam

### ❌ Evite

- Confiar em dados desatualizados (sempre busque a última execução)
- Modificar o fluxo enquanto visualiza uma execução (pode causar confusão)
- Assumir que o destaque permanece após reload

## Troubleshooting

### Nós não estão destacados

**Causa**: `nodeExecutions` vazio ou execução sem nós processados

**Solução**: Verifique se a execução realmente processou nós

### Dados de entrada/saída vazios

**Causa**: SessionStorage foi limpo ou execução antiga

**Solução**: Selecione a execução novamente

### Botão "Visualizar no Fluxo" não aparece

**Causa**: `onExecutionSelect` não foi passado ou execução não selecionada

**Solução**: Clique na execução para selecioná-la primeiro

## API

### Endpoint de Execuções

```
GET /api/executions?flowId={flowId}&limit={limit}
```

**Resposta**:

```json
{
  "executions": [...],
  "total": 20,
  "limit": 20,
  "offset": 0
}
```

### Estrutura de Execução

```typescript
interface Execution {
  id: string;
  status: 'running' | 'success' | 'error' | 'stopped';
  triggerType: 'webhook' | 'manual' | 'schedule';
  startTime: string;
  endTime?: string;
  duration?: number;
  error?: string;
  data?: any;
  result?: any;
  nodeExecutions?: Record<string, NodeExecution>;
}
```

## Suporte

Para mais informações:

- Documentação de Variáveis: `docs/dynamic-variables.md`
- Documentação de Webhooks: `docs/webhook-module.md`
- Documentação de Filas: `docs/queue-system.md`
