'use client';

import React, { useState, useMemo } from 'react';
import { ChatbotFlow } from '@/actions/chatbot-flows/flows';
import { useWorkflows, useDeleteWorkflow } from '@/lib/react-query/hooks';
import {
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Workflow,
  Search,
} from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { CreateWorkflowDialog } from '../../../features/dialogs/create-workflow-dialog';
import { FlowActions } from './flow-list-actions';
import { RenameFlowDialog } from './rename-flow-dialog';

interface FlowsListSidebarProps {
  onSelectFlow: (flow: ChatbotFlow) => void;
  currentFlowId: string | null;
  onCreateNewFlow: (flowName: string) => void;
}

export function FlowsListSidebar({
  onSelectFlow,
  currentFlowId,
  onCreateNewFlow,
}: FlowsListSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingFlow, setRenamingFlow] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Usar React Query para buscar workflows (userId obtido automaticamente no backend)
  const { data: workflows = [], isLoading: loading } = useWorkflows();

  // Filtrar workflows baseado no termo de pesquisa
  const filteredWorkflows = useMemo(() => {
    if (!searchTerm.trim()) return workflows;

    const term = searchTerm.toLowerCase();
    return workflows.filter(
      (flow) =>
        flow.name.toLowerCase().includes(term) ||
        (flow.description && flow.description.toLowerCase().includes(term)),
    );
  }, [workflows, searchTerm]);

  // Hook para deletar workflow
  const { mutate: deleteWorkflow } = useDeleteWorkflow({
    onSuccess: () => {
      alert('Fluxo deletado com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting flow:', error);
      alert(`Erro ao deletar: ${error.message}`);
    },
  });

  const handleDelete = (flowId: string) => {
    if (!confirm('Deseja realmente deletar este fluxo?')) return;
    deleteWorkflow(flowId);
  };

  const handleRename = (flowId: string, currentName: string) => {
    setRenamingFlow({ id: flowId, name: currentName });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleCreateFlow = (flowName: string) => {
    onCreateNewFlow(flowName);
    setIsCreateDialogOpen(false);
    // React Query invalida automaticamente a lista após criação
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="ghost"
          className="p-2"
          title="Expandir"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-56 min-w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-neutral-600" />
            <Typography
              variant="h3"
              className="text-md font-semibold text-neutral-600"
            >
              Workflows
            </Typography>
          </div>
          <Button
            onClick={() => setIsCollapsed(true)}
            variant="ghost"
            className="p-1.5 w-fit"
            title="Recolher"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Button>
        </div>
      </div>

      {/* Campo de Pesquisa fixo */}
      <div className="px-2 mt-2 pb-1 flex-shrink-0" style={{ zoom: 0.8 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Pesquisar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 rounded-md border placeholder:italic border-gray-300 bg-neutral-100 p-1 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm"
          />
        </div>
      </div>

      {/* Flows List */}
      <div className="flex-1 overflow-y-auto" style={{ zoom: 0.9 }}>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        ) : filteredWorkflows.length === 0 && searchTerm.trim() ? (
          <div className="p-8 text-center" style={{ zoom: 0.9 }}>
            <FileText className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <Typography
              variant="p"
              className="text-neutral-500 text-sm font-semibold"
            >
              Nenhum workflow encontrado
            </Typography>
            <Typography variant="p" className="text-xs text-gray-400 mt-1">
              Tente outro termo de pesquisa
            </Typography>
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-8 text-center" style={{ zoom: 0.9 }}>
            <FileText className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <Typography variant="p" className="text-neutral-600 text-sm">
              Nenhum workflow criado ainda
            </Typography>
            <Typography variant="p" className="mt-1">
              Crie seu primeiro workflow!
            </Typography>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              variant="gradient"
              className="w-full flex items-center justify-center gap-2 mt-4"
            >
              <Plus className="w-4 h-4" />
              Novo Workflow
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredWorkflows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => onSelectFlow(flow)}
                className={`w-full text-left px-6 py-3 rounded-lg transition-all group hover:shadow-md ${
                  currentFlowId === flow.id
                    ? 'bg-neutral-50 border border-neutral-200 shadow-lg ring-1 ring-neutral-400'
                    : 'border bg-white border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Typography
                      variant="span"
                      className={`font-semibold truncate !text-neutral-600`}
                    >
                      {flow.name}
                    </Typography>
                    {flow.description && (
                      <Typography
                        variant="p"
                        className="text-xs text-gray-500 truncate mt-0.5"
                      >
                        {flow.description}
                      </Typography>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3 text-neutral-600" />
                      <Typography variant="span" className="text-xs">
                        {formatDate(flow.updatedAt)}
                      </Typography>
                    </div>
                  </div>
                  <FlowActions
                    flowId={flow.id}
                    flowName={flow.name}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateWorkflowDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateFlow}
      />

      <RenameFlowDialog
        isOpen={!!renamingFlow}
        onClose={() => setRenamingFlow(null)}
        flowId={renamingFlow?.id || null}
        currentName={renamingFlow?.name || ''}
      />
    </div>
  );
}
