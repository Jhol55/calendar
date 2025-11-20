/**
 * Tipos compartilhados para Playwright MCP
 * Usado tanto no frontend quanto no backend para garantir consistência
 */

export interface PlaywrightMcpStepAction {
  id?: string; // ID único da ação (usado pelo frontend)
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

export type PlaywrightMcpStepMode = 'guided' | 'automatic';

export interface PlaywrightMcpStep {
  id?: string; // ID único da etapa (usado pelo frontend)
  mode?: PlaywrightMcpStepMode;
  url?: string | null;
  description?: string | null;
  prompt?: string | null; // Prompt específico para modo automático
  actions?: PlaywrightMcpStepAction[];
}

export interface PlaywrightMcpTaskInput {
  executionId: string;
  nodeId: string;
  flowId?: string;
  userId?: number;
  profile?: string;
  goal?: string;
  steps: PlaywrightMcpStep[];
  context: Record<string, any>;
}

export interface PlaywrightMcpTaskResult {
  success: boolean;
  error?: boolean;
  message?: string;
  data?: any;
  logs?: string[];
}

export interface PlaywrightMcpConfig {
  headless?: boolean;
  goal: string;
  startUrl?: string;
  mode?: 'autonomous' | 'guided' | 'hybrid';
  allowedDomains?: string[];
  maxSteps?: number | string;
  timeoutMs?: number | string;
  resultSchema?: string;
  steps?: PlaywrightMcpStep[];
}

// Aliases para compatibilidade (deprecated)
export type WebscraperStepAction = PlaywrightMcpStepAction;
export type WebscraperStepMode = PlaywrightMcpStepMode;
export type WebscraperStep = PlaywrightMcpStep;
export type WebscraperMcpStepAction = PlaywrightMcpStepAction;
export type WebscraperMcpStep = PlaywrightMcpStep;
export type WebscraperMcpTaskInput = PlaywrightMcpTaskInput;
export type WebscraperMcpTaskResult = PlaywrightMcpTaskResult;
