import React from 'react';
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  Zap,
  Webhook,
  Brain,
} from 'lucide-react';
import { NodeType } from './types';

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
    type: 'question',
    label: 'Pergunta',
    icon: <HelpCircle className="w-5 h-5" />,
    description: 'Fazer pergunta ao usuário',
    color: 'bg-purple-500',
  },
  {
    type: 'condition',
    label: 'Condição',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Criar ramificação lógica',
    color: 'bg-yellow-500',
  },
  {
    type: 'action',
    label: 'Ação',
    icon: <Zap className="w-5 h-5" />,
    description: 'Executar ação específica',
    color: 'bg-orange-500',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Receber requisições HTTP',
    color: 'bg-green-500',
  },
  {
    type: 'memory',
    label: 'Memória',
    icon: <Brain className="w-5 h-5" />,
    description: 'Salvar/buscar dados do usuário',
    color: 'bg-purple-600',
  },
];

interface SidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export function Sidebar({ onDragStart }: SidebarProps) {
  return (
    <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4 text-gray-800">Módulos</h2>

      <div className="space-y-2">
        {nodeTemplates.map((template) => (
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
                <h3 className="font-semibold text-sm">{template.label}</h3>
                <p className="text-xs text-gray-600 mt-1">
                  {template.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Dica:</strong> Arraste os módulos para o canvas e conecte-os
          para criar seu fluxo de chatbot.
        </p>
      </div>
    </div>
  );
}
