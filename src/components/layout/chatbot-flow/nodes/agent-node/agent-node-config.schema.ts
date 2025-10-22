import { z } from 'zod';

// Schema para ferramentas (tools) que a IA pode usar
export const agentToolSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome da ferramenta é obrigatório'),
  description: z.string().min(1, 'Descrição da ferramenta é obrigatória'),
  parameters: z.record(z.string(), z.any()).optional(),
  targetNodeId: z.string().optional(), // ID do node que será executado
});

// Schema principal de configuração do Agent Node
export const agentConfigSchema = z.object({
  // Provider e Modelo
  provider: z.enum(['openai']).default('openai'),
  model: z.string().min(1, 'Modelo é obrigatório').default('gpt-4o'),
  apiKey: z.string().min(1, 'API Key é obrigatória'),

  // Prompts
  systemPrompt: z
    .string()
    .min(1, 'System prompt é obrigatório')
    .default('Você é um assistente útil e educado.'),
  userPrompt: z.string().optional(), // Prompt do usuário (pode usar variáveis)

  // Parâmetros do modelo
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(0.7)
    .or(z.string().transform((val) => parseFloat(val))),
  maxTokens: z
    .number()
    .min(1)
    .max(32000)
    .default(1000)
    .or(z.string().transform((val) => parseInt(val))),
  topP: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .or(z.string().transform((val) => parseFloat(val))),
  frequencyPenalty: z
    .number()
    .min(-2)
    .max(2)
    .optional()
    .or(z.string().transform((val) => parseFloat(val))),
  presencePenalty: z
    .number()
    .min(-2)
    .max(2)
    .optional()
    .or(z.string().transform((val) => parseFloat(val))),

  // Contexto
  contextVariables: z.string().optional(), // JSON string com variáveis

  // Tools/Functions
  enableTools: z.boolean().default(false),
  tools: z.array(agentToolSchema).optional(),

  // Histórico de conversa
  enableHistory: z.boolean().default(true),
  historyLength: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .or(z.string().transform((val) => parseInt(val))),

  // Output
  saveResponseTo: z
    .string()
    .min(1, 'Nome da variável para salvar é obrigatório'),

  // Configuração de memória (igual outros nodes)
  memoryConfig: z
    .object({
      action: z.enum(['save', 'update', 'delete']),
      name: z.string(),
      value: z.string().optional(),
      ttl: z.number().optional(),
    })
    .optional(),
});

export type AgentToolConfig = z.infer<typeof agentToolSchema>;
export type AgentNodeConfigFormData = z.infer<typeof agentConfigSchema>;

// Modelos disponíveis por provider
export const OPENAI_MODELS = [
  // GPT-4o (Mais recente e otimizado)
  { value: 'gpt-4o', label: 'GPT-4o (Mais recente e rápido)' },
  { value: 'gpt-4o-2024-11-20', label: 'GPT-4o (20/11/2024)' },
  { value: 'gpt-4o-2024-08-06', label: 'GPT-4o (06/08/2024)' },
  { value: 'gpt-4o-2024-05-13', label: 'GPT-4o (13/05/2024)' },
  { value: 'chatgpt-4o-latest', label: 'ChatGPT-4o (Última versão)' },

  // GPT-4o Mini (Econômico)
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Econômico e rápido)' },
  { value: 'gpt-4o-mini-2024-07-18', label: 'GPT-4o Mini (18/07/2024)' },

  // O1 Series (Raciocínio avançado)
  { value: 'o1', label: 'O1 (Raciocínio complexo)' },
  { value: 'o1-2024-12-17', label: 'O1 (17/12/2024)' },
  { value: 'o1-mini', label: 'O1 Mini (Raciocínio econômico)' },
  { value: 'o1-mini-2024-09-12', label: 'O1 Mini (12/09/2024)' },
  { value: 'o1-preview', label: 'O1 Preview (Beta)' },
  { value: 'o1-preview-2024-09-12', label: 'O1 Preview (12/09/2024)' },

  // GPT-4 Turbo
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Estável)' },
  { value: 'gpt-4-turbo-2024-04-09', label: 'GPT-4 Turbo (09/04/2024)' },
  { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
  { value: 'gpt-4-0125-preview', label: 'GPT-4 Turbo (25/01/2024)' },
  { value: 'gpt-4-1106-preview', label: 'GPT-4 Turbo (06/11/2023)' },

  // GPT-4
  { value: 'gpt-4', label: 'GPT-4 (Base)' },
  { value: 'gpt-4-0613', label: 'GPT-4 (13/06/2023)' },
  { value: 'gpt-4-32k', label: 'GPT-4 32K (Contexto longo)' },
  { value: 'gpt-4-32k-0613', label: 'GPT-4 32K (13/06/2023)' },

  // GPT-3.5 Turbo
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Rápido e econômico)' },
  { value: 'gpt-3.5-turbo-0125', label: 'GPT-3.5 Turbo (25/01/2024)' },
  { value: 'gpt-3.5-turbo-1106', label: 'GPT-3.5 Turbo (06/11/2023)' },
  { value: 'gpt-3.5-turbo-16k', label: 'GPT-3.5 Turbo 16K' },
] as const;

// Template de system prompt padrão
export const DEFAULT_SYSTEM_PROMPT = `Você é um assistente virtual inteligente e educado.

Seu objetivo é ajudar o usuário da melhor forma possível, sendo:
- Claro e objetivo nas respostas
- Amigável e profissional
- Prestativo e proativo

Se você não souber algo, seja honesto e peça mais informações.
Se precisar de dados específicos, use as ferramentas disponíveis.`;

// Template de exemplo para context variables
export const CONTEXT_VARIABLES_TEMPLATE = `{
  "nome_usuario": "{{$memory.nome}}",
  "historico_compras": "{{$nodes.database_compras.output}}",
  "produto_atual": "{{produto_selecionado}}"
}`;
