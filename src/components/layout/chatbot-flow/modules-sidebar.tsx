import React, { memo, useState, useMemo } from 'react';
import {
  MessageSquare,
  GitBranch,
  Webhook,
  Brain,
  Settings,
  Database,
  Globe,
  Bot,
  Repeat,
  Code2,
  Search,
  Blocks,
  Globe2,
} from 'lucide-react';
import { NodeType } from './types';
import { Typography } from '@/components/ui/typography';

interface NodeTemplate {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'message',
    label: 'Mensagem',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'Enviar mensagem ao usuário',
    color: 'bg-blue-500',
  },
  {
    type: 'condition',
    label: 'Condição',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'IF/SWITCH - Decisões e ramificações',
    color: 'bg-violet-500',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Receber requisições HTTP',
    color: 'bg-emerald-500',
  },
  {
    type: 'memory',
    label: 'Memória',
    icon: <Brain className="w-5 h-5" />,
    description: 'Salvar/buscar dados do usuário',
    color: 'bg-fuchsia-500',
  },
  {
    type: 'transformation',
    label: 'Transformação',
    icon: <Settings className="w-5 h-5" />,
    description: 'Transformar e processar dados',
    color: 'bg-orange-500',
  },
  {
    type: 'database',
    label: 'Database',
    icon: <Database className="w-5 h-5" />,
    description: 'Gerenciar tabelas de dados',
    color: 'bg-cyan-500',
  },
  {
    type: 'http_request',
    label: 'HTTP Request',
    icon: <Globe className="w-5 h-5" />,
    description: 'Fazer requisições HTTP',
    color: 'bg-teal-500',
  },
  {
    type: 'agent',
    label: 'AI Agent',
    icon: <Bot className="w-5 h-5" />,
    description: 'Integrar IA (OpenAI GPT)',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: <Repeat className="w-5 h-5" />,
    description: 'Iterar sobre arrays e listas',
    color: 'bg-rose-500',
  },
  {
    type: 'code_execution',
    label: 'Code Execution',
    icon: <Code2 className="w-5 h-5" />,
    description: 'Executar código JS/Python seguro',
    color: 'bg-indigo-600',
  },
  {
    type: 'playwright-mcp-node',
    label: 'Playwright MCP',
    icon: <Globe2 className="w-5 h-5" />,
    description: 'Automatizar navegação web com Playwright + MCP',
    color: 'bg-emerald-600',
  },
];

interface SidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export const Sidebar = memo(function Sidebar({ onDragStart }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar módulos baseado no termo de pesquisa
  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return nodeTemplates;

    const term = searchTerm.toLowerCase();
    return nodeTemplates.filter(
      (template) =>
        template.label.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term),
    );
  }, [searchTerm]);

  return (
    <div
      className="w-64 bg-white border-l border-gray-200 overflow-y-auto"
      style={{ zoom: 0.9 }}
    >
      <div className="flex items-center justify-center gap-2 p-4 w-full border-b border-gray-200 mb-2">
        <Blocks className="w-5 h-5 text-neutral-600" />
        <Typography
          variant="h2"
          className="text-lg translate-y-[3px] font-bold text-neutral-600"
        >
          Módulos
        </Typography>
      </div>

      {/* Campo de Pesquisa */}
      <div className="px-2 pb-3" style={{ zoom: 0.9 }}>
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

      <div className="space-y-2 px-2 mb-2">
        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((template) => (
            <div
              key={template.type}
              draggable
              onDragStart={(e) => onDragStart(e, template.type)}
              className="p-3 border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow bg-white"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`${template.color} p-2 rounded text-white flex-shrink-0`}
                >
                  {template.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <Typography variant="h3" className="font-semibold text-sm">
                    {template.label}
                  </Typography>
                  <Typography
                    variant="p"
                    className="text-xs text-gray-600 mt-1"
                  >
                    {template.description}
                  </Typography>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center">
            <Typography variant="p" className="text-sm text-gray-500">
              Nenhum módulo encontrado
            </Typography>
            <Typography variant="p" className="text-xs text-gray-400 mt-1">
              Tente outro termo de pesquisa
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
});
