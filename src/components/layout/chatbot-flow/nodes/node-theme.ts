// Sistema de cores e estilos padronizados para os nodes do chatbot-flow

export type NodeThemeColor =
  | 'blue'
  | 'purple'
  | 'green'
  | 'indigo'
  | 'rose'
  | 'orange'
  | 'fuchsia'
  | 'violet'
  | 'cyan'
  | 'red'
  | 'gray';

export interface NodeTheme {
  iconBg: string;
  iconText: string;
  border: string;
  borderSelected: string;
  badgeBg: string;
  badgeText: string;
  handleColor: string;
}

export const nodeThemes: Record<NodeThemeColor, NodeTheme> = {
  blue: {
    iconBg: 'bg-blue-500',
    iconText: 'text-white',
    border: 'border-blue-200',
    borderSelected: 'border-blue-500',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    handleColor: '#3b82f6',
  },
  purple: {
    iconBg: 'bg-purple-500',
    iconText: 'text-white',
    border: 'border-purple-200',
    borderSelected: 'border-purple-500',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-600',
    handleColor: '#a855f7',
  },
  green: {
    iconBg: 'bg-emerald-500',
    iconText: 'text-white',
    border: 'border-emerald-200',
    borderSelected: 'border-emerald-500',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-600',
    handleColor: '#10b981',
  },
  indigo: {
    iconBg: 'bg-indigo-500',
    iconText: 'text-white',
    border: 'border-indigo-200',
    borderSelected: 'border-indigo-500',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-600',
    handleColor: '#6366f1',
  },
  rose: {
    iconBg: 'bg-rose-500',
    iconText: 'text-white',
    border: 'border-rose-200',
    borderSelected: 'border-rose-500',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-600',
    handleColor: '#f43f5e',
  },
  orange: {
    iconBg: 'bg-orange-500',
    iconText: 'text-white',
    border: 'border-orange-200',
    borderSelected: 'border-orange-500',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-600',
    handleColor: '#f97316',
  },
  fuchsia: {
    iconBg: 'bg-fuchsia-500',
    iconText: 'text-white',
    border: 'border-fuchsia-200',
    borderSelected: 'border-fuchsia-500',
    badgeBg: 'bg-fuchsia-50',
    badgeText: 'text-fuchsia-600',
    handleColor: '#d946ef',
  },
  violet: {
    iconBg: 'bg-violet-500',
    iconText: 'text-white',
    border: 'border-violet-200',
    borderSelected: 'border-violet-500',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-600',
    handleColor: '#8b5cf6',
  },
  cyan: {
    iconBg: 'bg-cyan-500',
    iconText: 'text-white',
    border: 'border-cyan-200',
    borderSelected: 'border-cyan-500',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-600',
    handleColor: '#06b6d4',
  },
  red: {
    iconBg: 'bg-red-500',
    iconText: 'text-white',
    border: 'border-red-200',
    borderSelected: 'border-red-500',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-600',
    handleColor: '#ef4444',
  },
  gray: {
    iconBg: 'bg-gray-500',
    iconText: 'text-white',
    border: 'border-gray-200',
    borderSelected: 'border-gray-500',
    badgeBg: 'bg-gray-50',
    badgeText: 'text-gray-600',
    handleColor: '#6b7280',
  },
};

// Mapeamento de tipo de node para cor
export const nodeTypeColors: Record<string, NodeThemeColor> = {
  message: 'blue',
  memory: 'fuchsia',
  database: 'cyan',
  codeExecution: 'orange',
  loop: 'rose',
  transformation: 'orange',
  condition: 'violet',
  webhook: 'green',
  playwrightMcp: 'green',
  agent: 'purple',
  httpRequest: 'orange',
  spreadsheet: 'green',
};

// Helper para obter tema de um tipo de node
export function getNodeTheme(nodeType: string): NodeTheme {
  const color = nodeTypeColors[nodeType] || 'gray';
  return nodeThemes[color];
}
