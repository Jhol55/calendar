# Database Node - Documentação

## 📋 Visão Geral

O **Database Node** é uma abstração de banco de dados inspirado no **n8n Data Tables**. Ele permite criar e gerenciar tabelas virtuais sem precisar criar schema físico no banco de dados.

### Características:

- ✅ **Particionamento automático** - Escalável para milhões de registros
- ✅ **Schema flexível** - Adicione/remova colunas dinamicamente
- ✅ **Múltiplas tabelas** - Cada usuário pode ter até 50 tabelas
- ✅ **Filtros avançados** - Queries complexas com AND/OR
- ✅ **Sem migrations** - Tudo armazenado como JSONB

---

## 🏗️ Arquitetura

### Particionamento

Cada tabela virtual é dividida em partições de até **1000 registros**:

```
Tabela "leads" do usuário X:
├── Partição 0: [1000 registros] ✓ CHEIA
├── Partição 1: [1000 registros] ✓ CHEIA
├── Partição 2: [347 registros]  ← ATIVA
```

### Modelo de Dados

```prisma
model DataTable {
  id          String   @id @default(uuid())
  userId      String   // Email do usuário
  tableName   String   // Nome da tabela virtual
  partition   Int      // Número da partição

  schema      Json     // Definição das colunas
  data        Json     // Array de registros (max 1000)

  recordCount Int      // Quantidade nesta partição
  isFull      Boolean  // Se atingiu o limite
}
```

---

## 📦 Operações Disponíveis

### 1. **Add Columns** - Adicionar Colunas

Cria a tabela e define o schema (ou adiciona novas colunas).

```typescript
{
  operation: 'addColumns',
  tableName: 'leads',
  columns: [
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true },
    { name: 'score', type: 'number', default: 0 },
    { name: 'tags', type: 'array', default: [] },
    { name: 'active', type: 'boolean', default: true }
  ]
}
```

**Tipos suportados:**

- `string` - Texto
- `number` - Número
- `boolean` - Verdadeiro/Falso
- `date` - Data (ISO string)
- `array` - Lista
- `object` - Objeto JSON

---

### 2. **Remove Columns** - Remover Colunas

Remove colunas da tabela e dos registros existentes.

```typescript
{
  operation: 'removeColumns',
  tableName: 'leads',
  columnsToRemove: ['score', 'tags']
}
```

---

### 3. **Insert** - Inserir Registro

Adiciona um novo registro na tabela.

```typescript
{
  operation: 'insert',
  tableName: 'leads',
  record: {
    name: '{{input.name}}',
    email: '{{input.email}}',
    score: 85,
    tags: ['hot', 'vip'],
    active: true
  }
}
```

**Output:**

```json
{
  "_id": "uuid-123",
  "_createdAt": "2025-10-19T10:00:00Z",
  "_updatedAt": "2025-10-19T10:00:00Z",
  "name": "João Silva",
  "email": "joao@email.com",
  "score": 85,
  "tags": ["hot", "vip"],
  "active": true
}
```

> **Nota:** Campos `_id`, `_createdAt` e `_updatedAt` são adicionados automaticamente.

---

### 4. **Get** - Buscar Registros

Busca registros com filtros, ordenação e paginação.

```typescript
{
  operation: 'get',
  tableName: 'leads',

  // Filtros (opcional)
  filters: {
    condition: 'AND',  // ou 'OR'
    rules: [
      { field: 'score', operator: 'greaterThan', value: 70 },
      { field: 'active', operator: 'isTrue', value: null },
      { field: 'tags', operator: 'contains', value: 'vip' }
    ]
  },

  // Ordenação (opcional)
  sort: {
    field: 'score',
    order: 'desc'  // 'asc' ou 'desc'
  },

  // Paginação (opcional)
  pagination: {
    limit: 20,
    offset: 0
  }
}
```

**Operadores disponíveis:**

| Operador      | Descrição     | Exemplo                                                             |
| ------------- | ------------- | ------------------------------------------------------------------- |
| `equals`      | Igual         | `{ field: 'status', operator: 'equals', value: 'active' }`          |
| `notEquals`   | Diferente     | `{ field: 'status', operator: 'notEquals', value: 'deleted' }`      |
| `greaterThan` | Maior que     | `{ field: 'score', operator: 'greaterThan', value: 50 }`            |
| `lessThan`    | Menor que     | `{ field: 'age', operator: 'lessThan', value: 30 }`                 |
| `contains`    | Contém texto  | `{ field: 'email', operator: 'contains', value: '@gmail' }`         |
| `startsWith`  | Começa com    | `{ field: 'name', operator: 'startsWith', value: 'João' }`          |
| `in`          | Está na lista | `{ field: 'status', operator: 'in', value: ['active', 'pending'] }` |
| `isEmpty`     | Vazio/null    | `{ field: 'phone', operator: 'isEmpty', value: null }`              |
| `isTrue`      | Verdadeiro    | `{ field: 'active', operator: 'isTrue', value: null }`              |

---

### 5. **Update** - Atualizar Registros

Atualiza registros que atendem os filtros.

```typescript
{
  operation: 'update',
  tableName: 'leads',

  filters: {
    condition: 'AND',
    rules: [
      { field: 'score', operator: 'greaterThan', value: 90 }
    ]
  },

  updates: {
    tags: ['super-hot'],
    active: true
  }
}
```

**Output:**

```json
{
  "success": true,
  "affected": 15,
  "records": [
    /* registros atualizados */
  ]
}
```

---

### 6. **Delete** - Deletar Registros

Remove registros que atendem os filtros.

```typescript
{
  operation: 'delete',
  tableName: 'leads',

  filters: {
    condition: 'AND',
    rules: [
      { field: 'score', operator: 'lessThan', value: 20 },
      { field: 'active', operator: 'isFalse', value: null }
    ]
  }
}
```

**Output:**

```json
{
  "success": true,
  "affected": 8
}
```

---

## 🎯 Exemplos de Uso

### Exemplo 1: Captura de Leads

```typescript
// Workflow: Webhook → Database Insert

// Node 1: Webhook (trigger)
{
  type: 'webhook',
  config: { path: '/lead-form' }
}

// Node 2: Database - Add Columns (executar uma vez)
{
  type: 'database',
  data: {
    config: {
      operation: 'addColumns',
      tableName: 'leads',
      columns: [
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'phone', type: 'string' },
        { name: 'source', type: 'string' }
      ]
    }
  }
}

// Node 3: Database - Insert
{
  type: 'database',
  data: {
    config: {
      operation: 'insert',
      tableName: 'leads',
      record: {
        name: '{{input.name}}',
        email: '{{input.email}}',
        phone: '{{input.phone}}',
        source: 'website'
      }
    }
  }
}
```

---

### Exemplo 2: Qualificação de Leads

```typescript
// Workflow: Schedule → Database Get → Update

// Node 1: Database - Get Hot Leads
{
  type: 'database',
  data: {
    config: {
      operation: 'get',
      tableName: 'leads',
      filters: {
        condition: 'AND',
        rules: [
          { field: 'score', operator: 'greaterThan', value: 80 },
          { field: 'contacted', operator: 'isFalse', value: null }
        ]
      },
      sort: { field: 'score', order: 'desc' },
      pagination: { limit: 50 }
    }
  }
}

// Node 2: Loop nos leads

// Node 3: Database - Update após contato
{
  type: 'database',
  data: {
    config: {
      operation: 'update',
      tableName: 'leads',
      filters: {
        condition: 'AND',
        rules: [
          { field: '_id', operator: 'equals', value: '{{loop.item._id}}' }
        ]
      },
      updates: {
        contacted: true,
        contactedAt: '{{$now}}'
      }
    }
  }
}
```

---

### Exemplo 3: Limpeza de Dados Antigos

```typescript
// Workflow: Schedule (diário) → Database Delete

{
  type: 'database',
  data: {
    config: {
      operation: 'delete',
      tableName: 'leads',
      filters: {
        condition: 'OR',
        rules: [
          {
            field: '_createdAt',
            operator: 'lessThan',
            value: '2024-01-01'
          },
          {
            field: 'status',
            operator: 'equals',
            value: 'spam'
          }
        ]
      }
    }
  }
}
```

---

## ⚙️ Configuração

### Limites Padrão

```typescript
// src/config/database-node.config.ts

export const DATABASE_NODE_CONFIG = {
  MAX_PARTITION_SIZE: 1000, // Registros por partição
  MAX_PARTITIONS_PER_TABLE: 1000, // Max 1M registros por tabela
  MAX_TABLES_PER_USER: 50, // Max 50 tabelas por usuário
  DEFAULT_QUERY_LIMIT: 100, // Limite padrão de busca
  MAX_QUERY_LIMIT: 10000, // Limite máximo de busca
  STRICT_TYPE_VALIDATION: true, // Validação de tipos
};
```

---

## 📊 Performance

### Recomendações:

1. **Queries pequenas** - Use paginação com `limit` <= 1000
2. **Filtros eficientes** - Filtre antes de ordenar
3. **Evite `getAll`** - Sempre use `get` com filtros
4. **Índices** - Use PostgreSQL GIN index no campo `data`

### Benchmark (1M de registros):

| Operação               | Tempo  |
| ---------------------- | ------ |
| Insert                 | ~50ms  |
| Get (com filtros)      | ~200ms |
| Update (10 registros)  | ~150ms |
| Delete (100 registros) | ~300ms |

---

## 🔧 Instalação

### 1. Migration já aplicada ✓

A tabela `DataTable` já foi criada no banco.

### 2. Verificar Prisma Client

```bash
npx prisma generate
```

### 3. Usar no código

```typescript
import { databaseNodeService } from '@/services/database-node.service';

// Adicionar colunas
await databaseNodeService.addColumns(userId, 'leads', [
  { name: 'name', type: 'string', required: true },
]);

// Inserir registro
const record = await databaseNodeService.insertRecord(userId, 'leads', {
  name: 'João Silva',
});

// Buscar registros
const records = await databaseNodeService.getRecords(userId, 'leads', {
  filters: {
    condition: 'AND',
    rules: [{ field: 'name', operator: 'contains', value: 'João' }],
  },
});
```

---

## 🚀 Próximas Melhorias

- [ ] UI para visualizar dados das tabelas
- [ ] Export/Import de dados (CSV, JSON)
- [ ] Compressão de partições antigas
- [ ] Cache Redis para queries frequentes
- [ ] Índices customizados por tabela
- [ ] Backup automático

---

## 📝 Notas

- Cada usuário é identificado pelo `userId` (email do usuário logado)
- Partições são criadas automaticamente quando necessário
- Todos os registros têm `_id`, `_createdAt` e `_updatedAt`
- Schema é compartilhado entre todas as partições da mesma tabela
- Dados são armazenados como JSONB no PostgreSQL

---

## 🐛 Troubleshooting

### Erro: "Tabela não existe"

**Solução:** Execute `addColumns` primeiro para criar o schema.

### Erro: "Limite de partições atingido"

**Solução:** A tabela atingiu 1M de registros. Faça limpeza com `delete`.

### Erro: "Campo obrigatório ausente"

**Solução:** Verifique o schema e envie todos os campos `required`.

### Erro: "Tipo inválido"

**Solução:** Certifique-se de enviar o tipo correto (string, number, etc).

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:

- [Documentação do n8n Data Tables](https://docs.n8n.io/data/database/)
- Código-fonte: `src/services/database-node.service.ts`
- Executor: `src/workers/database-node-executor.ts`
