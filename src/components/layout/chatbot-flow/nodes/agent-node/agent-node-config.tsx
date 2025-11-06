'use client';

import React, { useEffect, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { SubmitButton } from '@/components/ui/submit-button';
import { NodeConfigLayout } from '../node-config-layout';
import {
  agentConfigSchema,
  OPENAI_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  CONTEXT_VARIABLES_TEMPLATE,
} from './agent-node-config.schema';
import { AgentConfig, AgentTool, MemoryItem } from '../../types';
import { Plus, Trash2, Settings2, Sparkles, Bot } from 'lucide-react';
import { MemoryConfigSection } from '../memory-config-section';

interface AgentNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AgentConfig) => void;
  config?: AgentConfig;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

function AgentFormFields({
  config,
  memoryItems,
  setMemoryItems,
  tools,
  setTools,
  enableHistory,
  setEnableHistory,
}: {
  config?: AgentConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  tools: AgentTool[];
  setTools: React.Dispatch<React.SetStateAction<AgentTool[]>>;
  enableHistory: boolean;
  setEnableHistory: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { form, setValue } = useForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Carregar valores do config para o formulário
  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('provider', config.provider || 'openai');
        setValue('model', config.model || 'gpt-4o');
        setValue('apiKey', config.apiKey || '');
        setValue('systemPrompt', config.systemPrompt || '');
        setValue('userPrompt', config.userPrompt || '');
        setValue('temperature', config.temperature?.toString() || '0.7');
        setValue('maxTokens', config.maxTokens?.toString() || '1000');
        setValue('topP', config.topP?.toString() || '');
        setValue('frequencyPenalty', config.frequencyPenalty?.toString() || '');
        setValue('presencePenalty', config.presencePenalty?.toString() || '');
        setValue('contextVariables', config.contextVariables || '');
        setValue('enableTools', config.enableTools || false);
        setValue('enableHistory', config.enableHistory || false);
        setValue('historyLength', config.historyLength?.toString() || '10');
        setValue('saveResponseTo', config.saveResponseTo || '');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  // Adicionar nova tool
  const addTool = () => {
    const newTool: AgentTool = {
      id: `tool-${Date.now()}`,
      name: '',
      description: '',
      parameters: {},
      targetNodeId: '',
    };
    setTools([...tools, newTool]);
  };

  // Remover tool
  const removeTool = (index: number) => {
    const newTools = tools.filter((_, i) => i !== index);
    setTools(newTools);
  };

  // Atualizar tool
  const updateTool = (
    index: number,
    field: keyof AgentTool,
    value: string | Record<string, unknown>,
  ) => {
    const newTools = [...tools];
    newTools[index] = { ...newTools[index], [field]: value };
    setTools(newTools);
  };

  // Carregar template de system prompt
  const loadDefaultPrompt = () => {
    setValue('systemPrompt', DEFAULT_SYSTEM_PROMPT);
  };

  // Carregar template de context variables
  const loadContextTemplate = () => {
    setValue('contextVariables', CONTEXT_VARIABLES_TEMPLATE);
  };

  return (
    <>
      {/* Seção: Provider e Modelo */}
      <div className="space-y-3">
        <Typography
          variant="h5"
          className="font-semibold flex items-center gap-2"
        >
          <Bot className="w-5 h-5" />
          Modelo de IA
        </Typography>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-1">
            <FormControl variant="label">Provider</FormControl>
            <FormSelect
              fieldName="provider"
              options={[{ value: 'openai', label: 'OpenAI' }]}
              placeholder="Selecione o provider"
              className="w-full"
            />
          </div>

          <div className="p-1">
            <FormControl variant="label">Modelo</FormControl>
            <FormSelect
              fieldName="model"
              options={OPENAI_MODELS.map((m) => ({
                value: m.value,
                label: m.label,
              }))}
              placeholder="Selecione o modelo"
              className="w-full"
            />
          </div>
        </div>

        <div className="p-1">
          <FormControl variant="label">API Key</FormControl>
          <Input
            type="password"
            fieldName="apiKey"
            placeholder="sk-... ou {{$memory.openai_key}}"
            className="font-mono text-sm"
          />
          <Typography variant="span" className="text-xs text-gray-600 mt-1">
            💡 Você pode usar uma variável como {`{{$memory.openai_key}}`} para
            maior segurança
          </Typography>
        </div>
      </div>

      {/* Seção: System Prompt */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <FormControl variant="label">
            System Prompt (Personalidade da IA)
          </FormControl>
          <Button
            type="button"
            variant="ghost"
            onClick={loadDefaultPrompt}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Carregar Template
          </Button>
        </div>
        <Textarea
          fieldName="systemPrompt"
          placeholder="Você é um assistente..."
          rows={6}
          className="font-mono text-sm"
        />
        <Typography variant="span" className="text-xs text-gray-600">
          Define como a IA deve se comportar e responder. Seja específico sobre
          o tom, estilo e conhecimento.
        </Typography>
      </div>

      {/* Seção: User Prompt (opcional) */}
      <div className="p-1">
        <FormControl variant="label">User Prompt (Opcional)</FormControl>
        <Textarea
          fieldName="userPrompt"
          placeholder="Ex: Responda a pergunta: {{$node.input.message.text}}"
          rows={3}
          className="font-mono text-sm"
        />
        <Typography variant="span" className="text-xs text-gray-600">
          Prompt enviado como mensagem do usuário. Use variáveis como{' '}
          {`{{$node.input.message.text}}`}
        </Typography>
      </div>

      {/* Seção: Parâmetros do Modelo */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Typography variant="h5" className="font-semibold">
            Parâmetros do Modelo
          </Typography>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="w-4 h-4 mr-1" />
            {showAdvanced ? 'Ocultar' : 'Avançado'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-1">
            <FormControl variant="label">
              Temperature (Criatividade)
            </FormControl>
            <Input
              type="number"
              fieldName="temperature"
              placeholder="0.7"
              step="0.1"
              min="0"
              max="2"
            />
            <Typography variant="span" className="text-xs text-gray-600">
              0 = Determinístico, 2 = Muito criativo
            </Typography>
          </div>

          <div className="p-1">
            <FormControl variant="label">
              Max Tokens (Tamanho da resposta)
            </FormControl>
            <Input
              type="number"
              fieldName="maxTokens"
              placeholder="1000"
              min="1"
              max="32000"
            />
            <Typography variant="span" className="text-xs text-gray-600">
              ~4 caracteres = 1 token
            </Typography>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-lg">
            <div className="p-1">
              <FormControl variant="label">Top P</FormControl>
              <Input
                type="number"
                fieldName="topP"
                placeholder="1"
                step="0.1"
                min="0"
                max="1"
              />
            </div>

            <div className="p-1">
              <FormControl variant="label">Frequency Penalty</FormControl>
              <Input
                type="number"
                fieldName="frequencyPenalty"
                placeholder="0"
                step="0.1"
                min="-2"
                max="2"
              />
            </div>

            <div className="p-1">
              <FormControl variant="label">Presence Penalty</FormControl>
              <Input
                type="number"
                fieldName="presencePenalty"
                placeholder="0"
                step="0.1"
                min="-2"
                max="2"
              />
            </div>
          </div>
        )}
      </div>

      {/* Seção: Context Variables */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <FormControl variant="label">
            Variáveis de Contexto (JSON)
          </FormControl>
          <Button
            type="button"
            variant="ghost"
            onClick={loadContextTemplate}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Exemplo
          </Button>
        </div>
        <Textarea
          fieldName="contextVariables"
          placeholder={CONTEXT_VARIABLES_TEMPLATE}
          rows={6}
          className="font-mono text-sm"
        />
        <Typography variant="span" className="text-xs text-gray-600">
          JSON com dados dinâmicos que a IA pode usar. Suporta variáveis do
          fluxo.
        </Typography>
      </div>

      {/* Seção: Tools/Functions */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Typography variant="h5" className="font-semibold">
              🛠️ Ferramentas (Tools)
            </Typography>
            <Typography variant="span" className="text-xs text-gray-600">
              Funções que a IA pode chamar quando precisar de dados ou executar
              ações
            </Typography>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tools.length > 0}
              onChange={(e) => {
                if (e.target.checked && tools.length === 0) {
                  addTool();
                } else if (!e.target.checked) {
                  setTools([]);
                }
                setValue('enableTools', e.target.checked);
              }}
              className="w-4 h-4"
            />
            <Typography variant="span" className="text-sm">
              Habilitar Tools
            </Typography>
          </label>
        </div>

        {tools.length > 0 && (
          <div className="space-y-3">
            {tools.map((tool, index) => (
              <div
                key={tool.id}
                className="p-3 bg-white rounded-lg border border-green-300 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Typography
                    variant="span"
                    className="text-sm font-medium text-green-900"
                  >
                    Tool #{index + 1}
                  </Typography>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeTool(index)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Nome da Função
                    </label>
                    <input
                      type="text"
                      value={tool.name}
                      onChange={(e) =>
                        updateTool(index, 'name', e.target.value)
                      }
                      placeholder="Ex: buscar_produto"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Target Node ID (opcional)
                    </label>
                    <input
                      type="text"
                      value={tool.targetNodeId || ''}
                      onChange={(e) =>
                        updateTool(index, 'targetNodeId', e.target.value)
                      }
                      placeholder="ID do node a executar"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Descrição (o que essa função faz)
                  </label>
                  <textarea
                    value={tool.description}
                    onChange={(e) =>
                      updateTool(index, 'description', e.target.value)
                    }
                    placeholder="Ex: Busca informações de um produto pelo ID"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Parâmetros (JSON)
                  </label>
                  <textarea
                    value={
                      tool.parameters
                        ? JSON.stringify(tool.parameters, null, 2)
                        : '{}'
                    }
                    onChange={(e) => {
                      try {
                        const params = JSON.parse(e.target.value);
                        updateTool(index, 'parameters', params);
                      } catch {
                        // Ignorar erro de JSON inválido enquanto digita
                      }
                    }}
                    placeholder='{"produto_id": "string"}'
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              onClick={addTool}
              className="w-full border-dashed border-2 border-gray-300 text-gray-700 hover:bg-gray-50/40"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tool
            </Button>
          </div>
        )}
      </div>

      {/* Seção: Histórico de Conversa */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Typography variant="h5" className="font-semibold">
              💬 Histórico de Conversa
            </Typography>
            <Typography variant="span" className="text-xs text-gray-600">
              Mantém contexto entre mensagens do mesmo usuário
            </Typography>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableHistory}
              onChange={(e) => {
                setEnableHistory(e.target.checked);
                setValue('enableHistory', e.target.checked);
              }}
              className="w-4 h-4"
            />
            <Typography variant="span" className="text-sm">
              Habilitar Histórico
            </Typography>
          </label>
        </div>

        {enableHistory && (
          <div className="p-1">
            <FormControl variant="label">Manter últimas mensagens</FormControl>
            <Input
              type="number"
              fieldName="historyLength"
              placeholder="10"
              min="1"
              max="50"
            />
            <Typography variant="span" className="text-xs text-gray-600">
              Quantas mensagens anteriores a IA deve lembrar
            </Typography>
          </div>
        )}
      </div>

      {/* Seção: Output */}
      <div className="p-1 border-t pt-4">
        <FormControl variant="label">💾 Salvar Resposta Em</FormControl>
        <Input
          type="text"
          fieldName="saveResponseTo"
          placeholder="resposta_ia"
          className="font-mono"
        />
        <Typography variant="span" className="text-xs text-gray-600">
          Nome da variável para acessar a resposta da IA em outros nodes
        </Typography>
      </div>

      {/* Seção: Memória */}
      <MemoryConfigSection
        memoryItems={memoryItems}
        setMemoryItems={setMemoryItems}
        form={form}
        setValue={setValue}
      />

      <SubmitButton
        variant="gradient"
        className="absolute top-2 right-12 w-fit mt-4"
      >
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export default function AgentNodeConfig({
  isOpen,
  onClose,
  onSave,
  config,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: AgentNodeConfigProps) {
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [enableHistory, setEnableHistory] = useState(false);

  // Inicializar tools do config
  useEffect(() => {
    if (config?.tools && config.tools.length > 0) {
      setTools(config.tools);
    } else {
      setTools([]);
    }
  }, [config]);

  // Inicializar enableHistory do config
  useEffect(() => {
    setEnableHistory(config?.enableHistory || false);
  }, [config]);

  // Inicializar memória do config
  useEffect(() => {
    if (config?.memoryConfig) {
      setMemoryItems([
        {
          key: config.memoryConfig.name,
          value: config.memoryConfig.value || '',
        },
      ]);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    const agentConfig: AgentConfig = {
      provider: data.provider as 'openai',
      model: data.model,
      apiKey: data.apiKey,
      systemPrompt: data.systemPrompt,
      userPrompt: data.userPrompt || undefined,
      temperature: data.temperature ? parseFloat(data.temperature) : 0.7,
      maxTokens: data.maxTokens ? parseInt(data.maxTokens) : 1000,
      topP: data.topP ? parseFloat(data.topP) : undefined,
      frequencyPenalty: data.frequencyPenalty
        ? parseFloat(data.frequencyPenalty)
        : undefined,
      presencePenalty: data.presencePenalty
        ? parseFloat(data.presencePenalty)
        : undefined,
      contextVariables: data.contextVariables || undefined,
      enableTools: tools.length > 0,
      tools: tools.length > 0 ? tools : undefined,
      enableHistory: enableHistory,
      historyLength: data.historyLength ? parseInt(data.historyLength) : 10,
      saveResponseTo: data.saveResponseTo,
    };

    // Adicionar configuração de memória se preenchida
    if (
      memoryItems.length > 0 &&
      memoryItems[0].key &&
      data.memoryAction &&
      data.memoryAction !== ''
    ) {
      let ttl: number | undefined = undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      agentConfig.memoryConfig = {
        action: data.memoryAction as 'save' | 'update' | 'delete',
        name: memoryItems[0].key,
        value:
          data.memoryAction !== 'delete' ? memoryItems[0].value : undefined,
        ttl,
      };
    }

    onSave(agentConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar AI Agent"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={agentConfigSchema}
        onSubmit={handleSubmit}
      >
        <AgentFormFields
          config={config}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
          tools={tools}
          setTools={setTools}
          enableHistory={enableHistory}
          setEnableHistory={setEnableHistory}
        />
      </Form>
    </NodeConfigLayout>
  );
}
