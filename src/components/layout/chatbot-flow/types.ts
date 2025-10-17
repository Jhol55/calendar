export type NodeType =
  | 'start'
  | 'message'
  | 'question'
  | 'condition'
  | 'action'
  | 'webhook'
  | 'end';

export type MessageType =
  | 'text'
  | 'media'
  | 'contact'
  | 'location'
  | 'interactive_menu';

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
  menuOptions?: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
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

export interface NodeData {
  label: string;
  type: NodeType;
  content?: string;
  messageConfig?: MessageConfig;
  webhookConfig?: WebhookConfig;
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
