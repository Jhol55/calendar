/**
 * Serviço para integração com OpenAI API
 * Suporta chat completion com tools/functions calling e gerenciamento de histórico
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string;
  name?: string; // Para tool/function responses
  tool_call_id?: string; // Para tool responses
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason:
      | 'stop'
      | 'length'
      | 'tool_calls'
      | 'function_call'
      | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Chama a API de Chat Completion da OpenAI
 */
export async function createChatCompletion(
  apiKey: string,
  params: ChatCompletionParams,
): Promise<ChatCompletionResponse> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API Error ${response.status}: ${error.error?.message || response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Formata tools para o formato da OpenAI
 */
export function formatToolsForOpenAI(
  tools: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>,
): ChatCompletionParams['tools'] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }));
}

/**
 * Trunca histórico de mensagens para manter apenas as últimas N mensagens
 * Sempre mantém a mensagem system no início
 */
export function truncateHistory(
  messages: ChatMessage[],
  maxLength: number,
): ChatMessage[] {
  // Separar system message das outras
  const systemMessages = messages.filter((m) => m.role === 'system');
  const otherMessages = messages.filter((m) => m.role !== 'system');

  // Se já está dentro do limite, retornar tudo
  if (otherMessages.length <= maxLength) {
    return messages;
  }

  // Pegar apenas as últimas N mensagens (excluindo system)
  const truncated = otherMessages.slice(-maxLength);

  // Retornar system messages + mensagens truncadas
  return [...systemMessages, ...truncated];
}

/**
 * Adiciona contexto de variáveis ao system prompt ou user prompt
 */
export function injectContext(
  prompt: string,
  context: Record<string, unknown>,
): string {
  if (!context || Object.keys(context).length === 0) {
    return prompt;
  }

  const contextString = Object.entries(context)
    .map(([key, value]) => {
      const valueStr =
        typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value);
      return `${key}: ${valueStr}`;
    })
    .join('\n');

  return `${prompt}\n\n**Contexto Adicional:**\n${contextString}`;
}
