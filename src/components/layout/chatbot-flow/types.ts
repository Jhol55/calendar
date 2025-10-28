export type NodeType =
  | 'start'
  | 'message'
  | 'condition'
  | 'webhook'
  | 'memory'
  | 'transformation'
  | 'database'
  | 'http_request'
  | 'agent'
  | 'loop'
  | 'code_execution'
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
  mediaType?:
    | 'image'
    | 'video'
    | 'document'
    | 'audio'
    | 'myaudio'
    | 'ptt'
    | 'sticker';
  docName?: string;
  caption?: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  // Configuração de menu interativo
  interactiveMenu?: InteractiveMenuConfig;
  // Opções avançadas para mensagens de texto
  linkPreview?: boolean;
  linkPreviewTitle?: string;
  linkPreviewDescription?: string;
  linkPreviewImage?: string;
  linkPreviewLarge?: boolean;
  replyId?: string;
  mentions?: string;
  readChat?: boolean;
  readMessages?: boolean;
  delay?: number;
  forward?: boolean;
  trackSource?: string;
  trackId?: string;
  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
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
  saveMode?: 'overwrite' | 'append'; // Novo: modo de salvamento
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
  | 'mapObject'
  | 'sort'
  | 'first'
  | 'last'
  | 'join'
  | 'unique'
  | 'length'
  | 'sum'
  | 'deleteKeys'
  | 'renameKeys'
  | 'extractField'
  | 'flatMap';

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
  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
}

// Condition Node Types
export type ConditionType = 'if' | 'switch';

export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'regex_match';

export type LogicOperator = 'AND' | 'OR';

export interface ConditionRule {
  id: string;
  variable: string; // Suporta {{variáveis}}
  operator: ComparisonOperator;
  value: string;
  logicOperator?: LogicOperator; // Para conectar com próxima condição
}

export interface SwitchCase {
  id: string;
  label: string; // Label para exibir no handle
  rules: ConditionRule[]; // Múltiplas regras para este caso (com operadores lógicos)
  // Campos antigos mantidos para compatibilidade
  variable?: string;
  operator?: ComparisonOperator;
  value?: string;
}

export interface ConditionConfig {
  conditionType: ConditionType;

  // Para IF
  rules?: ConditionRule[];

  // Para SWITCH
  variable?: string; // Deprecated - mantido para compatibilidade
  cases?: SwitchCase[];
  useDefaultCase?: boolean;

  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
}

// Database Node Types
export type DatabaseOperation =
  | 'addColumns'
  | 'removeColumns'
  | 'insert'
  | 'update'
  | 'delete'
  | 'get';

export type ColumnType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object';

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  default?: any;
}

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface FilterConfig {
  condition: 'AND' | 'OR';
  rules: FilterRule[];
}

export interface DatabaseConfig {
  operation: DatabaseOperation;
  tableName: string;

  // Para addColumns
  columns?: ColumnDefinition[];

  // Para removeColumns
  columnsToRemove?: string[];

  // Para insert
  record?: Record<string, any>;

  // Para update
  updates?: Record<string, any>;

  // Para update, delete, get
  filters?: FilterConfig;

  // Para get
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

// HTTP Request Node Types
export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  bodyType?: 'json' | 'text' | 'form';
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
  saveResponse?: boolean;
  responseVariable?: string;
  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
}

// ==================== LOOP NODE ====================

export interface LoopConfig {
  // Input data
  inputData: string; // Variável ou array literal {{data}} ou [1,2,3]

  // Loop settings
  batchSize: number; // Quantos itens processar por vez (default: 1)
  mode: 'each' | 'batch'; // 'each' = 1 por vez, 'batch' = n por vez

  // Output settings
  accumulateResults?: boolean; // Se deve acumular resultados de cada iteração
  outputVariable?: string; // Nome da variável para armazenar o batch atual

  // Loop control
  maxIterations?: number; // Limite máximo de iterações (proteção)
  pauseBetweenIterations?: number; // Delay em ms entre iterações

  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
}

// ==================== CODE EXECUTION NODE ====================

export type CodeExecutionLanguage = 'javascript' | 'python';

export interface CodeExecutionConfig {
  // Code settings
  language: CodeExecutionLanguage;
  code: string; // Código a ser executado

  // Input/Output
  inputVariables?: string; // JSON com variáveis de entrada ex: {"x": "{{$webhook.body.value}}"}
  outputVariable?: string; // Nome da variável de saída (default: "codeResult")

  // Execution settings
  timeout?: number; // Timeout em segundos (default: 5)

  // Judge0 settings (opcional para usar instância customizada)
  judge0Url?: string; // URL customizada do Judge0 (default: http://localhost:2358)

  // Configuração de memória (opcional)
  memoryConfig?: MemoryConfig;
}

export interface NodeData {
  label: string;
  type: NodeType;
  content?: string;
  messageConfig?: MessageConfig;
  webhookConfig?: WebhookConfig;
  memoryConfig?: MemoryConfig;
  transformationConfig?: TransformationConfig;
  conditionConfig?: ConditionConfig;
  databaseConfig?: DatabaseConfig;
  httpRequestConfig?: HttpRequestConfig;
  agentConfig?: AgentConfig;
  loopConfig?: LoopConfig;
  codeExecutionConfig?: CodeExecutionConfig;
  conditions?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  actions?: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  // Handlers para execução parcial (não são serializados)
  onPartialExecute?: (nodeId: string) => void | Promise<void>;
  isNodeExecuting?: (nodeId: string) => boolean;
}

export interface FlowData {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AGENT NODE ====================

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
  targetNodeId?: string; // ID do node que será executado quando a tool for chamada
}

export interface AgentConfig {
  // Provider e Modelo
  provider: 'openai';
  model: string;
  apiKey: string;

  // Prompts
  systemPrompt: string;
  userPrompt?: string;

  // Parâmetros do modelo
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;

  // Contexto
  contextVariables?: string; // JSON string

  // Tools
  enableTools?: boolean;
  tools?: AgentTool[];

  // Histórico
  enableHistory?: boolean;
  historyLength?: number;

  // Output
  saveResponseTo: string;

  // Memory config (opcional)
  memoryConfig?: {
    action: 'save' | 'update' | 'delete';
    name: string;
    value?: string;
    ttl?: number;
  };
}
