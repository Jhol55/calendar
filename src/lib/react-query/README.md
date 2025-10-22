# React Query Library

Implementação profissional do React Query v5 otimizada para segurança, performance e manutenibilidade.

## 🚀 Quick Start

```typescript
import { useWorkflows, useCreateWorkflow } from '@/lib/react-query/hooks';

function MyComponent() {
  const { data, isLoading } = useWorkflows();
  const { mutate } = useCreateWorkflow();

  if (isLoading) return <Loading />;

  return <List data={data} onCreate={mutate} />;
}
```

## 📚 Documentação

- [Guia de Implementação Completo](../../../docs/react-query-implementation.md)
- [Guia de Migração](../../../docs/react-query-migration-guide.md)

## 📦 Estrutura

```
lib/react-query/
├── config.ts              # Configurações globais
├── query-keys.ts         # Factory de query keys
├── types.ts              # TypeScript types
├── utils.ts              # Utilities
├── error-handler.ts      # Error handling
├── persistent-cache.ts   # Cache persistente
├── hooks/                # Hooks customizados
│   ├── use-workflows.ts
│   ├── use-user.ts
│   ├── use-database.ts
│   ├── use-executions.ts
│   └── index.ts
└── index.ts              # Exports
```

## ✨ Features

### Segurança

- ✅ Validação de dados automática
- ✅ Sanitização de respostas
- ✅ Rate limiting
- ✅ Query key validation
- ✅ Error sanitization

### Performance

- ✅ Cache inteligente (4 estratégias)
- ✅ Optimistic updates
- ✅ Prefetching
- ✅ Deduplicação automática
- ✅ Structural sharing
- ✅ Garbage collection

### Developer Experience

- ✅ Type-safety completo
- ✅ Error handling robusto
- ✅ DevTools integrado
- ✅ Cross-tab sync
- ✅ Persistent cache (opcional)
- ✅ Hooks bem documentados

## 🎯 Hooks Disponíveis

### Workflows

```typescript
useWorkflows(); // Listar workflows
useWorkflow(id); // Buscar workflow específico
useCreateWorkflow(); // Criar workflow
useUpdateWorkflow(); // Atualizar workflow
useDeleteWorkflow(); // Deletar workflow
usePrefetchWorkflow(); // Prefetch workflow
useInvalidateWorkflows(); // Invalidar cache
```

### User

```typescript
useUser(); // Dados do usuário
useInstances(); // Instâncias do usuário
useInstance(id); // Instância específica
useUpdateUser(); // Atualizar usuário
useLogout(); // Logout
useInvalidateUser(); // Invalidar cache
usePrefetchUser(); // Prefetch user data
```

### Database

```typescript
useTables(); // Listar tabelas
useTableData(); // Dados da tabela
useTableSchema(); // Schema da tabela
useInsertTableRow(); // Inserir linha
useUpdateTableRow(); // Atualizar linha
useDeleteTableRow(); // Deletar linha
useInvalidateDatabase(); // Invalidar cache
```

### Executions

```typescript
useExecutions(); // Listar execuções
useFlowExecutions(id); // Execuções do flow
useExecution(id); // Execução específica
useCancelExecution(); // Cancelar execução
useInvalidateExecutions(); // Invalidar cache
usePrefetchExecutions(); // Prefetch executions
```

## 🔑 Query Keys

Use as factories para garantir consistência:

```typescript
import { workflowKeys, userKeys } from '@/lib/react-query';

// Workflows
workflowKeys.all; // ['workflows']
workflowKeys.lists(); // ['workflows', 'list']
workflowKeys.detail(id); // ['workflows', 'detail', id]

// User
userKeys.all; // ['user']
userKeys.profile(); // ['user', 'profile']
userKeys.instances(); // ['user', 'instances']
```

## ⚙️ Configuração

### Cache Times

```typescript
import { CACHE_TIMES } from '@/lib/react-query';

CACHE_TIMES.STATIC; // 30min fresh, 1h gc
CACHE_TIMES.USER; // 10min fresh, 30min gc
CACHE_TIMES.DYNAMIC; // 2min fresh, 10min gc
CACHE_TIMES.REALTIME; // 30s fresh, 5min gc
```

### Provider

```tsx
import { ReactQueryProvider } from '@/components/providers';

<ReactQueryProvider
  enablePersistence={false} // localStorage cache
  enableCrossTabSync={true} // Sync entre abas
>
  <App />
</ReactQueryProvider>;
```

## 🛠️ Utilities

```typescript
import {
  safeQueryFn,
  invalidateQueries,
  prefetchQueries,
  optimisticUpdate,
  rollbackOptimisticUpdate,
  clearStaleQueries,
  getQueriesStatus,
} from '@/lib/react-query';
```

## 🐛 Error Handling

```typescript
import {
  categorizeError,
  formatErrorMessage,
  ErrorLogger,
} from '@/lib/react-query/error-handler';

// Erros são automaticamente:
// - Categorizados
// - Logados
// - Formatados para usuário
// - Sanitizados
```

## 📊 Monitoring

```typescript
import { getQueriesStatus, queryClient } from '@/lib/react-query';

// Ver status de todas as queries
const status = getQueriesStatus(queryClient);
console.log(status);
// {
//   total: 10,
//   fetching: 2,
//   stale: 3,
//   inactive: 5,
//   error: 0
// }
```

## 🧪 Testing

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('should fetch workflows', async () => {
  const { result } = renderHook(() => useWorkflows(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});
```

## 📖 Exemplos

### Listar e Criar

```typescript
function WorkflowManager() {
  const { data: workflows, isLoading } = useWorkflows();
  const { mutate: create, isPending } = useCreateWorkflow({
    onSuccess: () => toast.success('Criado!'),
  });

  return (
    <>
      {isLoading && <Skeleton />}
      <List data={workflows} />
      <CreateButton onClick={() => create(data)} loading={isPending} />
    </>
  );
}
```

### Editar com Optimistic Update

```typescript
function WorkflowEditor({ id }) {
  const { data: workflow } = useWorkflow(id);
  const { mutate: update } = useUpdateWorkflow();

  const handleSave = (data) => {
    update({ id, data });
    // UI atualiza instantaneamente
    // Rollback automático se falhar
  };

  return <Editor workflow={workflow} onSave={handleSave} />;
}
```

### Prefetch ao Hover

```typescript
function WorkflowCard({ id }) {
  const prefetch = usePrefetchWorkflow();

  return (
    <Link
      href={`/workflow/${id}`}
      onMouseEnter={() => prefetch(id)}
    >
      View Workflow
    </Link>
  );
}
```

### Auto-refetch com Intervalo

```typescript
function ExecutionMonitor({ flowId }) {
  const { data: executions } = useFlowExecutions(flowId);
  // Auto-refetch a cada 3s se houver execuções ativas

  return <ExecutionList executions={executions} />;
}
```

## 🔒 Segurança

### Rate Limiting

```typescript
import { rateLimiter } from '@/lib/react-query';

// Máximo de 10 requisições por minuto
if (!rateLimiter.canMakeRequest('endpoint')) {
  throw new Error('Too many requests');
}
```

### Validação de Dados

```typescript
// Automático em todas as queries
const data = await safeQueryFn(apiCall, {
  validateResponse: (response) => {
    return response?.success === true;
  },
});
```

### Sanitização

```typescript
// Automático - remove __proto__, constructor, prototype
// Ver: config.ts -> sanitizeData()
```

## 🎓 Best Practices

1. **Sempre usar query key factories**
2. **Tratar erros explicitamente**
3. **Mostrar loading states**
4. **Usar optimistic updates**
5. **Prefetch quando possível**
6. **Invalidar cache específico**
7. **Usar `enabled` para queries condicionais**
8. **Testar invalidações**

## 🆘 Suporte

- [Documentação Completa](../../../docs/react-query-implementation.md)
- [Guia de Migração](../../../docs/react-query-migration-guide.md)
- [React Query Docs](https://tanstack.com/query/latest)

---

**Made with 💙 by Senior Developers**
