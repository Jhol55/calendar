/**
 * React Query - Exemplos de Uso
 *
 * Exemplos práticos e completos de como usar os hooks
 */

'use client';

import React from 'react';
import {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  usePrefetchWorkflow,
  useUser,
  useInstances,
  useFlowExecutions,
} from './hooks';

// ============================================================================
// EXEMPLO 1: Lista Simples
// ============================================================================

export function WorkflowList() {
  const { data: workflows, isLoading, error } = useWorkflows();

  if (isLoading) {
    return <div>Carregando workflows...</div>;
  }

  if (error) {
    return <div>Erro: {error.message}</div>;
  }

  return (
    <ul>
      {workflows?.map((workflow) => <li key={workflow.id}>{workflow.name}</li>)}
    </ul>
  );
}

// ============================================================================
// EXEMPLO 2: Criar com Feedback
// ============================================================================

export function CreateWorkflowButton() {
  const { mutate, isPending, isSuccess, isError } = useCreateWorkflow({
    onSuccess: (newWorkflow) => {
      console.log('Workflow criado:', newWorkflow.id);
      // Navegar para o workflow criado
    },
    onError: (error) => {
      console.error('Erro ao criar:', error.message);
    },
  });

  const handleCreate = () => {
    mutate({
      name: 'Novo Workflow',
      description: 'Descrição',
      nodes: [],
      edges: [],
      token: 'token-123',
      userId: 'user-123',
    });
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isPending}>
        {isPending ? 'Criando...' : 'Criar Workflow'}
      </button>

      {isSuccess && <span>✅ Criado com sucesso!</span>}
      {isError && <span>❌ Erro ao criar</span>}
    </div>
  );
}

// ============================================================================
// EXEMPLO 3: Editar com Optimistic Update
// ============================================================================

export function WorkflowEditor({ id }: { id: string }) {
  const { data: workflow, isLoading } = useWorkflow(id);
  const { mutate: update, isPending } = useUpdateWorkflow();

  if (isLoading) return <div>Carregando...</div>;
  if (!workflow) return <div>Workflow não encontrado</div>;

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    update({
      id,
      data: {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      },
    });
    // UI atualiza instantaneamente (optimistic update)
    // Rollback automático se falhar
  };

  return (
    <form onSubmit={handleSave}>
      <input name="name" defaultValue={workflow.name} disabled={isPending} />
      <textarea
        name="description"
        defaultValue={workflow.description || ''}
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  );
}

// ============================================================================
// EXEMPLO 4: Deletar com Confirmação
// ============================================================================

export function DeleteWorkflowButton({ id }: { id: string }) {
  const { mutate: deleteWorkflow, isPending } = useDeleteWorkflow({
    onSuccess: () => {
      console.log('Workflow deletado');
      // Redirecionar para lista
    },
  });

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja deletar?')) {
      deleteWorkflow(id);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-600"
    >
      {isPending ? 'Deletando...' : 'Deletar'}
    </button>
  );
}

// ============================================================================
// EXEMPLO 5: Prefetch ao Hover
// ============================================================================

export function WorkflowCard({ id, name }: { id: string; name: string }) {
  const prefetch = usePrefetchWorkflow();

  return (
    <div
      onMouseEnter={() => prefetch(id)}
      className="cursor-pointer hover:bg-gray-100"
    >
      <h3>{name}</h3>
      <p>ID: {id}</p>
      {/* Ao fazer hover, os dados já são carregados */}
      {/* Quando clicar, renderização é instantânea */}
    </div>
  );
}

// ============================================================================
// EXEMPLO 6: Conditional Query
// ============================================================================

export function ConditionalWorkflow({
  shouldFetch,
  id,
}: {
  shouldFetch: boolean;
  id: string;
}) {
  const { data, isLoading } = useWorkflow(id, {
    enabled: shouldFetch, // Só faz fetch se shouldFetch for true
  });

  if (!shouldFetch) {
    return <div>Fetch desabilitado</div>;
  }

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return <div>{data?.name}</div>;
}

// ============================================================================
// EXEMPLO 7: Dependent Queries
// ============================================================================

export function DependentQueries({ workflowId }: { workflowId: string }) {
  // Primeiro busca o workflow
  const { data: workflow, isLoading: isLoadingWorkflow } =
    useWorkflow(workflowId);

  // Só busca execuções se workflow foi carregado
  const { data: executions, isLoading: isLoadingExecutions } =
    useFlowExecutions(workflow?.id || null, {
      enabled: !!workflow?.id,
    });

  if (isLoadingWorkflow) {
    return <div>Carregando workflow...</div>;
  }

  if (!workflow) {
    return <div>Workflow não encontrado</div>;
  }

  return (
    <div>
      <h2>{workflow.name}</h2>

      {isLoadingExecutions ? (
        <div>Carregando execuções...</div>
      ) : (
        <ul>
          {executions?.map((exec) => (
            <li key={exec.id}>
              {exec.id} - {exec.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// EXEMPLO 8: Background Refetching
// ============================================================================

export function WorkflowWithBackgroundRefetch({ id }: { id: string }) {
  const { data: workflow, isFetching } = useWorkflow(id, {
    refetchInterval: 30000, // Refetch a cada 30 segundos
    refetchOnWindowFocus: true, // Refetch ao focar janela
  });

  return (
    <div>
      <h2>
        {workflow?.name}
        {isFetching && <span className="ml-2">🔄</span>}
      </h2>
      {/* Sempre mostra dados atualizados */}
    </div>
  );
}

// ============================================================================
// EXEMPLO 9: Pagination
// ============================================================================

export function PaginatedWorkflows() {
  const [page, setPage] = React.useState(0);

  const { data: workflows, isLoading } = useWorkflows({
    // Configurar filtros de paginação
    // Implementar no hook se necessário
  });

  return (
    <div>
      {isLoading && <div>Carregando...</div>}

      <ul>
        {workflows
          ?.slice(page * 10, (page + 1) * 10)
          .map((workflow) => <li key={workflow.id}>{workflow.name}</li>)}
      </ul>

      <div>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button onClick={() => setPage((p) => p + 1)}>Próxima</button>
      </div>
    </div>
  );
}

// ============================================================================
// EXEMPLO 10: Combining Queries
// ============================================================================

export function Dashboard() {
  const { data: user, isLoading: isLoadingUser } = useUser();
  const { data: instances, isLoading: isLoadingInstances } = useInstances();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();

  const isLoading = isLoadingUser || isLoadingInstances || isLoadingWorkflows;

  if (isLoading) {
    return <div>Carregando dashboard...</div>;
  }

  return (
    <div>
      <h1>Dashboard de {user?.name}</h1>

      <section>
        <h2>Instâncias ({instances?.length || 0})</h2>
        <ul>
          {instances?.map((instance) => (
            <li key={instance.id}>{instance.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Workflows ({workflows?.length || 0})</h2>
        <ul>
          {workflows?.map((workflow) => (
            <li key={workflow.id}>{workflow.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ============================================================================
// EXEMPLO 11: Error Handling Avançado
// ============================================================================

export function WorkflowWithErrorHandling({ id }: { id: string }) {
  const {
    data: workflow,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useWorkflow(id);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Erro ao carregar workflow</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? 'Tentando novamente...' : 'Tentar Novamente'}
        </button>
      </div>
    );
  }

  if (!workflow) {
    return <div>Workflow não encontrado</div>;
  }

  return <div>{workflow.name}</div>;
}

// ============================================================================
// EXEMPLO 12: Custom Hook Composition
// ============================================================================

export function useWorkflowWithExecutions(id: string) {
  const workflow = useWorkflow(id);
  const executions = useFlowExecutions(id, {
    enabled: !!workflow.data,
  });

  return {
    workflow: workflow.data,
    executions: executions.data,
    isLoading: workflow.isLoading || executions.isLoading,
    error: workflow.error || executions.error,
    refetchAll: () => {
      workflow.refetch();
      executions.refetch();
    },
  };
}

export function WorkflowWithExecutions({ id }: { id: string }) {
  const { workflow, executions, isLoading, error, refetchAll } =
    useWorkflowWithExecutions(id);

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      <h2>{workflow?.name}</h2>
      <button onClick={refetchAll}>Atualizar Tudo</button>

      <h3>Execuções</h3>
      <ul>{executions?.map((exec) => <li key={exec.id}>{exec.status}</li>)}</ul>
    </div>
  );
}

// ============================================================================
// EXEMPLO 13: Polling com Condição
// ============================================================================

export function ExecutionMonitor({ executionId }: { executionId: string }) {
  const { data: execution } = useExecution(executionId);

  // Auto-refetch a cada 2s se status for 'running' ou 'pending'
  // Já implementado no hook useExecution

  const isActive =
    execution?.status === 'running' || execution?.status === 'pending';

  return (
    <div>
      <h3>Execução {executionId}</h3>
      <p>Status: {execution?.status}</p>
      {isActive && <span>⏳ Atualizando automaticamente...</span>}
    </div>
  );
}
