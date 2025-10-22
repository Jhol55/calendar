# 🚀 React Query - Quick Start Guide

## ⚡ Começando em 5 Minutos

### 1️⃣ Usar em Componentes

#### Buscar dados:

```tsx
import { useWorkflows } from '@/lib/react-query/hooks';

function MyComponent() {
  const { data, isLoading, error } = useWorkflows();

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <ul>
      {data?.map((workflow) => <li key={workflow.id}>{workflow.name}</li>)}
    </ul>
  );
}
```

#### Criar dados:

```tsx
import { useCreateWorkflow } from '@/lib/react-query/hooks';

function CreateButton() {
  const { mutate, isPending } = useCreateWorkflow();

  const handleCreate = () => {
    mutate({
      name: 'Novo Workflow',
      description: 'Descrição',
      nodes: [],
      edges: [],
      token: 'token',
      userId: 'user-id',
    });
  };

  return (
    <button onClick={handleCreate} disabled={isPending}>
      {isPending ? 'Criando...' : 'Criar'}
    </button>
  );
}
```

#### Atualizar dados:

```tsx
import { useUpdateWorkflow } from '@/lib/react-query/hooks';

function EditButton({ id }) {
  const { mutate } = useUpdateWorkflow();

  const handleSave = () => {
    mutate({ id, data: { name: 'Novo Nome' } });
    // UI atualiza instantaneamente! ✨
  };

  return <button onClick={handleSave}>Salvar</button>;
}
```

#### Deletar dados:

```tsx
import { useDeleteWorkflow } from '@/lib/react-query/hooks';

function DeleteButton({ id }) {
  const { mutate } = useDeleteWorkflow();

  return <button onClick={() => mutate(id)}>Deletar</button>;
}
```

### 2️⃣ Hooks Disponíveis

#### Workflows

```tsx
import {
  useWorkflows, // Lista todos
  useWorkflow, // Busca um
  useCreateWorkflow, // Cria
  useUpdateWorkflow, // Atualiza
  useDeleteWorkflow, // Deleta
} from '@/lib/react-query/hooks';
```

#### User

```tsx
import {
  useUser, // Dados do usuário
  useInstances, // Instâncias
  useUpdateUser, // Atualizar usuário
  useLogout, // Logout
} from '@/lib/react-query/hooks';
```

#### Executions

```tsx
import {
  useExecutions, // Lista execuções
  useFlowExecutions, // Execuções de um flow
  useExecution, // Uma execução
  useCancelExecution, // Cancelar
} from '@/lib/react-query/hooks';
```

### 3️⃣ Features Automáticas

#### ✅ Já Funciona Automaticamente:

1. **Cache Inteligente**

   - Dados ficam em cache
   - Não faz requisições desnecessárias
   - Atualiza quando necessário

2. **Optimistic Updates**

   - UI atualiza instantaneamente
   - Rollback automático se falhar
   - Zero código extra necessário

3. **Error Handling**

   - Erros categorizados
   - Mensagens formatadas
   - Logging automático

4. **Loading States**

   - `isLoading` - primeira carga
   - `isFetching` - refetch
   - `isPending` - mutation em andamento

5. **Retry Logic**
   - Retry automático em erros de rede
   - Não retry em erros de validação
   - Backoff exponencial

### 4️⃣ Padrões Comuns

#### Atualizar lista após criar:

```tsx
// ✅ Automático! Não precisa fazer nada
const { mutate } = useCreateWorkflow();
mutate(data);
// Lista atualiza automaticamente
```

#### Invalidar cache manualmente:

```tsx
import { useInvalidateWorkflows } from '@/lib/react-query/hooks';

function RefreshButton() {
  const { invalidateAll } = useInvalidateWorkflows();

  return <button onClick={invalidateAll}>Atualizar</button>;
}
```

#### Prefetch ao hover:

```tsx
import { usePrefetchWorkflow } from '@/lib/react-query/hooks';

function Card({ id }) {
  const prefetch = usePrefetchWorkflow();

  return (
    <div onMouseEnter={() => prefetch(id)}>Passe o mouse para carregar</div>
  );
}
```

#### Query condicional:

```tsx
const { data } = useWorkflow(id, {
  enabled: !!id, // Só busca se id existir
});
```

#### Auto-refetch:

```tsx
const { data } = useFlowExecutions(flowId);
// Auto-refetch a cada 3s se houver execuções ativas
// Já implementado! ✨
```

### 5️⃣ Dicas Pro

#### 1. Sempre tratar loading e error:

```tsx
const { data, isLoading, error } = useWorkflows();

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
// Agora pode usar data com segurança
```

#### 2. Usar callbacks em mutations:

```tsx
const { mutate } = useCreateWorkflow({
  onSuccess: () => toast.success('Criado!'),
  onError: (error) => toast.error(error.message),
});
```

#### 3. Não invalidar demais:

```tsx
// ❌ Evitar
invalidateAll(); // Muito broad

// ✅ Preferir
invalidateDetail(id); // Específico
```

#### 4. Usar enabled para queries dependentes:

```tsx
const { data: workflow } = useWorkflow(id);
const { data: executions } = useFlowExecutions(workflow?.id, {
  enabled: !!workflow?.id, // Só busca se workflow existir
});
```

### 6️⃣ Debugging

#### DevTools (apenas em desenvolvimento):

- Botão flutuante no canto inferior esquerdo
- Visualizar queries ativas
- Ver cache
- Forçar refetch
- Ver erros

#### Console:

```tsx
import { getQueriesStatus, queryClient } from '@/lib/react-query';

console.log(getQueriesStatus(queryClient));
// { total: 10, fetching: 2, stale: 3, ... }
```

### 7️⃣ Precisa de Ajuda?

📚 **Documentação Completa:**

- [Guia de Implementação](docs/react-query-implementation.md)
- [Guia de Migração](docs/react-query-migration-guide.md)
- [Exemplos](src/lib/react-query/examples.tsx)

### 8️⃣ Principais Diferenças do Código Antigo

#### Antes:

```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch()
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

#### Agora:

```tsx
const { data, isLoading } = useWorkflows();
// É só isso! ✨
```

---

## 🎯 Resumo

### O que você ganha:

- ⚡ **Performance**: Cache inteligente, prefetch, deduplicação
- 🔒 **Segurança**: Validação, sanitização, rate limiting
- 🎨 **UX**: Optimistic updates, loading states, error handling
- 🧹 **Código Limpo**: Menos código, mais funcionalidades
- 🐛 **Debugging**: DevTools, logging automático

### O que você NÃO precisa mais fazer:

- ❌ Gerenciar estado manualmente
- ❌ Implementar cache
- ❌ Escrever lógica de retry
- ❌ Tratar erros em cada componente
- ❌ Implementar optimistic updates
- ❌ Invalidar cache manualmente (na maioria dos casos)

---

**🚀 Comece a usar agora!**

Basta importar os hooks e usar. Tudo já está configurado e otimizado!

```tsx
import { useWorkflows } from '@/lib/react-query/hooks';
```
