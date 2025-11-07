/**
 * Helper para processamento do Agent Node no worker
 */

import {
  createChatCompletion,
  formatToolsForOpenAI,
  injectContext,
  truncateHistory,
  ChatMessage,
} from '../../../services/openai.service';
import {
  getConversationHistory,
  addMessagesToHistory,
} from '../../../services/agent-conversation.service';
import { AgentConfig } from '../../../components/layout/chatbot-flow/types';

interface ProcessAgentNodeParams {
  config: AgentConfig;
  userId: string; // ID do usuário final (WhatsApp)
  flowId?: string;
  nodeId?: string;
  variableContext: Record<string, unknown>; // Contexto de variáveis do fluxo
  replaceVariables: (text: string, context: Record<string, unknown>) => string;
}

export async function processAgentNode(params: ProcessAgentNodeParams) {
  const { config, userId, flowId, nodeId, variableContext, replaceVariables } =
    params;

  // Substituir variáveis na API key
  const apiKey = replaceVariables(config.apiKey, variableContext);

  // Preparar mensagens
  const messages: ChatMessage[] = [];

  // 1. System Prompt (sempre presente)
  let systemPrompt = config.systemPrompt;

  // Injetar context variables se houver
  if (config.contextVariables) {
    try {
      const contextVarsStr = replaceVariables(
        config.contextVariables,
        variableContext,
      );
      const contextVars = JSON.parse(contextVarsStr);
      systemPrompt = injectContext(systemPrompt, contextVars);
    } catch (error) {
      console.warn('Error parsing context variables:', error);
    }
  }

  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // 2. Carregar histórico se habilitado
  if (config.enableHistory) {
    const history = await getConversationHistory(userId, flowId, nodeId);

    // Remover system messages do histórico (já adicionamos acima)
    const historyWithoutSystem = history.filter((m) => m.role !== 'system');

    // Truncar histórico
    const truncated = truncateHistory(
      historyWithoutSystem,
      config.historyLength || 10,
    );

    messages.push(...truncated);
  }

  // 3. User Prompt atual
  let userPrompt = config.userPrompt;

  // Se não tiver user prompt configurado, usar mensagem do webhook
  if (!userPrompt) {
    // Tentar pegar do input
    const inputMessage =
      variableContext.$node?.input?.message?.text ||
      variableContext.$node?.input?.data?.message?.text ||
      variableContext.$node?.input?.body?.message?.text ||
      'Continue a conversa';

    userPrompt = String(inputMessage);
  } else {
    // Substituir variáveis no user prompt
    userPrompt = replaceVariables(userPrompt, variableContext);
  }

  messages.push({
    role: 'user',
    content: userPrompt,
  });

  // 4. Preparar tools se habilitadas
  let tools: ReturnType<typeof formatToolsForOpenAI> | undefined;
  if (config.enableTools && config.tools && config.tools.length > 0) {
    tools = formatToolsForOpenAI(config.tools);
  }

  // 5. Fazer chamada para OpenAI
  console.log('🤖 Calling OpenAI with:', {
    model: config.model,
    messagesCount: messages.length,
    toolsCount: tools?.length || 0,
  });

  const response = await createChatCompletion(apiKey, {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    frequency_penalty: config.frequencyPenalty,
    presence_penalty: config.presencePenalty,
    tools,
    tool_choice: tools ? 'auto' : undefined,
  });

  const choice = response.choices[0];
  const assistantMessage = choice.message;

  // 6. Salvar no histórico se habilitado
  if (config.enableHistory) {
    await addMessagesToHistory(
      userId,
      [{ role: 'user', content: userPrompt }, assistantMessage],
      flowId,
      nodeId,
      config.historyLength,
    );
  }

  // 7. Processar resposta
  const result: {
    response: string;
    finish_reason: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model: string;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  } = {
    response: assistantMessage.content,
    finish_reason: choice.finish_reason,
    usage: response.usage,
    model: response.model,
  };

  // Se a IA chamou tools
  if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
    result.tool_calls = assistantMessage.tool_calls.map((call) => ({
      id: call.id,
      type: call.type,
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    }));

    console.log('🛠️ AI requested tool calls:', result.tool_calls);

    // TODO: Implementar execução automática de tools
    // Por enquanto, retornar as tool_calls para o usuário processar
  }

  return result;
}
