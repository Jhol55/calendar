export type NodeType =
  | 'start'
  | 'message'
  | 'question'
  | 'condition'
  | 'action'
  | 'webhook'
  | 'memory'
  | 'transformation'
  | 'end';

export type MessageType =
  | 'text'
  | 'media'
  | 'contact'
  | 'location'
  | 'interactive_menu';

export type InteractiveMenuType = 'button' | 'list' | 'poll' | 'carousel';

export interface InteractiveMenuConfig {
  type: InteractiveMenuType;
  text: string;
  choices: string[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
  imageButton?: string;
}

export interface MessageConfig {
  token?: string;
  phoneNumber?: string;
  messageType: MessageType;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  // Configuração de menu interativo
  interactiveMenu?: InteractiveMenuConfig;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface WebhookConfig {
  serviceType?: 'manual' | 'whatsapp';
  instanceToken?: string;
  webhookId: string; // Sempre obrigatório para identificar o webhook
  webhookUrl?: string;
  methods?: HttpMethod[];
  description?: string;
  responseData?: string;
  headers?: Record<string, string>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface MemoryItem {
  key: string;
  value: string;
}

export interface MemoryConfig {
  action: 'save' | 'fetch' | 'delete';
  memoryName: string;
  items?: MemoryItem[];
  ttl?: number;
  defaultValue?: string;
}

export type TransformationType =
  | 'string'
  | 'number'
  | 'date'
  | 'array'
  | 'object'
  | 'validation';

export type StringOperation =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'replace'
  | 'substring'
  | 'split'
  | 'concat'
  | 'capitalize';

export type NumberOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'round'
  | 'formatCurrency'
  | 'toPercent';

export type DateOperation =
  | 'format'
  | 'addDays'
  | 'subtractDays'
  | 'diffDays'
  | 'extractPart'
  | 'now';

export type ArrayOperation =
  | 'filter'
  | 'map'
  | 'sort'
  | 'first'
  | 'last'
  | 'join'
  | 'unique'
  | 'length'
  | 'sum';

export type ObjectOperation =
  | 'extract'
  | 'merge'
  | 'keys'
  | 'values'
  | 'stringify'
  | 'parse';

export type ValidationOperation =
  | 'validateEmail'
  | 'validatePhone'
  | 'formatPhone'
  | 'removeMask'
  | 'sanitize';

export type TransformationOperation =
  | StringOperation
  | NumberOperation
  | DateOperation
  | ArrayOperation
  | ObjectOperation
  | ValidationOperation;

export interface TransformationStep {
  id: string; // ID único para cada step do pipeline
  type: TransformationType;
  operation: TransformationOperation;
  input: string; // Suporta variáveis dinâmicas
  params?: Record<string, any>; // Parâmetros extras baseados na operação
}

export interface TransformationConfig {
  steps: TransformationStep[]; // Pipeline de transformações
  outputAs?: string; // Nome da variável de saída (opcional)
}

export interface NodeData {
  label: string;
  type: NodeType;
  content?: string;
  messageConfig?: MessageConfig;
  webhookConfig?: WebhookConfig;
  memoryConfig?: MemoryConfig;
  transformationConfig?: TransformationConfig;
  conditions?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  actions?: Array<{
    type: string;
    params: Record<string, any>;
  }>;
}

export interface FlowData {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: Date;
  updatedAt: Date;
}
