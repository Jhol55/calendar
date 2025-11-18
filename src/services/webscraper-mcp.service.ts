/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WebscraperMcpStepAction {
  action:
    | 'goto_url'
    | 'click'
    | 'double_click'
    | 'type'
    | 'type_and_submit'
    | 'scroll_down'
    | 'scroll_up'
    | 'scroll_to_view'
    | 'wait'
    | 'switch_to_iframe'
    | 'switch_to_default_content'
    | 'switch_to_tab'
    | 'close_current_tab'
    | 'go_back'
    | 'go_forward'
    | 'hover'
    | 'select_option_by_text'
    | 'select_option_by_value';
  selectorType?: 'css' | 'xpath' | 'tag_name';
  selector?: string | null;
  text?: string | null;
}

export interface WebscraperMcpStep {
  mode?: 'guided' | 'automatic';
  url?: string | null;
  description?: string | null;
  actions?: WebscraperMcpStepAction[];
}

export interface WebscraperMcpTaskInput {
  executionId: string;
  nodeId: string;
  flowId?: string;
  userId?: number;
  profile?: string;
  goal?: string;
  steps: WebscraperMcpStep[];
  context: Record<string, any>;
}

export interface WebscraperMcpTaskResult {
  success: boolean;
  error?: boolean;
  message?: string;
  data?: any;
  logs?: string[];
}

export async function runWebscraperMcpTask(
  input: WebscraperMcpTaskInput,
): Promise<WebscraperMcpTaskResult> {
  const logs: string[] = [];

  const baseUrl =
    process.env.WEBSCRAPER_MCP_URL || 'http://127.0.0.1:5000/mcp/run';

  // logs.push(
  //   `🌐 Chamando WebScraper MCP em ${baseUrl}`,
  //   `🧾 executionId=${input.executionId}, nodeId=${input.nodeId}, flowId=${input.flowId}, userId=${input.userId}`,
  // );

  // Garantir ao menos uma etapa básica se nada for enviado
  const safeSteps = input.steps && input.steps.length > 0 ? input.steps : [];

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: input.userId ? String(input.userId) : undefined,
        profile:
          input.profile ||
          (input.userId ? `user_${input.userId}` : input.executionId),
        goal: input.goal,
        steps: safeSteps,
        context: input.context || {},
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logs.push(
        `❌ Erro HTTP ao chamar WebScraper MCP (status ${response.status}): ${text}`,
      );

      return {
        success: false,
        error: true,
        message: `Falha ao chamar serviço WebScraper MCP (status ${response.status}).`,
        logs,
      };
    }

    const json: any = await response.json();

    // Esperamos { success, data, logs }
    const serviceLogs = Array.isArray(json.logs) ? json.logs : [];
    logs.push(...serviceLogs);

    return {
      success: Boolean(json.success),
      error: json.success === false,
      message:
        json.message ||
        (json.success ? 'WebScraper MCP executado com sucesso.' : undefined),
      data: json.data,
      logs,
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Erro desconhecido ao chamar WebScraper MCP';
    logs.push(`❌ Erro de rede/execução ao chamar WebScraper MCP: ${msg}`);

    return {
      success: false,
      error: true,
      message: msg,
      logs,
    };
  }
}
