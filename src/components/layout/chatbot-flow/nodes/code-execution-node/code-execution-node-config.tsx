'use client';

import React, { useEffect, useState } from 'react';
import { CodeExecutionConfig, MemoryItem } from '../../types';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { codeExecutionConfigSchema } from './code-execution-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from '../node-config-layout';
import { MemoryConfigSection } from '../memory-config-section';
import { Code2, Info, Play } from 'lucide-react';

interface CodeExecutionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: CodeExecutionConfig;
  onSave: (config: CodeExecutionConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

function CodeExecutionFormFields({
  config,
  memoryItems,
  setMemoryItems,
}: {
  config?: CodeExecutionConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue } = useForm();
  const language =
    (form.language as 'javascript' | 'python' | 'typescript') || 'javascript';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('language', config.language || 'javascript');
        setValue('code', config.code || '');
        setValue('inputVariables', config.inputVariables || '');
        setValue('outputVariable', config.outputVariable || 'codeResult');
        setValue('timeout', config.timeout?.toString() || '5');
        setValue('judge0Url', config.judge0Url || '');

        // Carregar configuração de memória
        if (config.memoryConfig) {
          setValue('memoryAction', config.memoryConfig.action || 'save');
          setValue('memoryName', config.memoryConfig.memoryName || '');
          setValue(
            'memorySaveMode',
            config.memoryConfig.saveMode || 'overwrite',
          );
          setValue(
            'memoryDefaultValue',
            config.memoryConfig.defaultValue || '',
          );

          // Carregar items de memória
          if (
            config.memoryConfig.items &&
            config.memoryConfig.items.length > 0
          ) {
            setMemoryItems(config.memoryConfig.items);
            setValue('memoryItems', config.memoryConfig.items);
          }

          // Carregar TTL
          if (config.memoryConfig.ttl) {
            const ttlString = String(config.memoryConfig.ttl);
            const ttlPresets = ['3600', '86400', '604800', '2592000'];
            if (ttlPresets.includes(ttlString)) {
              setValue('memoryTtlPreset', ttlString);
            } else {
              setValue('memoryTtlPreset', 'custom');
              setValue('memoryCustomTtl', ttlString);
            }
          } else {
            setValue('memoryTtlPreset', 'never');
          }
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue, setMemoryItems]);

  // Exemplos de código baseado na linguagem selecionada
  const getCodeExample = () => {
    switch (language) {
      case 'javascript':
        return `// ⚠️ IMPORTANTE: Use console.log() para ver o resultado!
// ❌ NÃO use "return" - não funciona em código isolado
// ✅ Use console.log() para imprimir o resultado

const a = 10;
const b = 20;
const result = a + b;
console.log(result); // ✅ Para números/strings simples

// 💡 Para arrays/objetos, use JSON.stringify para garantir parse automático:
// console.log(JSON.stringify(result)); // ✅ Melhor para objetos complexos`;
      case 'typescript':
        return `// ⚠️ IMPORTANTE: Use console.log() para ver o resultado!

const sum = (a: number, b: number): number => a + b;
const result = sum(10, 20);
console.log(result); // ✅ Para números/strings simples

// 💡 Para arrays/objetos, use JSON.stringify para garantir parse automático:
// console.log(JSON.stringify(result)); // ✅ Melhor para objetos complexos`;
      case 'python':
        return `# ⚠️ IMPORTANTE: Use print() para ver o resultado!
# ❌ NÃO use apenas valores - não serão capturados
# ✅ Use print() para imprimir o resultado

a = 10
b = 20
result = a + b
print(result)  # ✅ Para números/strings simples

# 💡 Para listas/dicts, use json.dumps para garantir parse automático:
# import json
# print(json.dumps(result))  # ✅ Melhor para objetos complexos`;
      default:
        return '';
    }
  };

  return (
    <>
      {/* Banner informativo */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg mb-4">
        <div className="flex items-start gap-3">
          <Code2 className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <Typography
              variant="span"
              className="text-sm font-semibold text-purple-900"
            >
              💡 Code Execution Node
            </Typography>
            <Typography
              variant="span"
              className="text-xs text-purple-800 block"
            >
              Execute código JavaScript, TypeScript ou Python de forma segura
              usando Judge0.
            </Typography>
            <ul className="text-xs text-purple-800 space-y-1 ml-4">
              <li>
                <strong>🔒 Seguro:</strong> Código roda em sandbox isolado
              </li>
              <li>
                <strong>⚡ Rápido:</strong> Timeout configurável (máx 30s)
              </li>
              <li>
                <strong>🔄 Variáveis:</strong> Passe dados via inputVariables
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Linguagem */}
      <div className="p-1">
        <FormControl variant="label">
          Linguagem *
          <Info className="w-4 h-4 inline ml-1 text-neutral-500" />
        </FormControl>
        <FormSelect
          fieldName="language"
          placeholder="Selecione a linguagem"
          options={[
            { value: 'javascript', label: '🟨 JavaScript (Node.js)' },
            { value: 'typescript', label: '🔷 TypeScript (Node.js)' },
            { value: 'python', label: '🐍 Python 3' },
          ]}
          className="w-full"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Escolha a linguagem de programação para executar o código
        </Typography>
      </div>

      {/* Código */}
      <div className="p-1">
        <FormControl variant="label">
          Código *
          <Play className="w-4 h-4 inline ml-1 text-neutral-500" />
        </FormControl>
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md mb-2">
          <Typography
            variant="span"
            className="text-xs text-yellow-800 font-semibold"
          >
            ⚠️ Use console.log() (JS/TS) ou print() (Python) para retornar
            valores!
          </Typography>
          <Typography
            variant="span"
            className="text-xs text-yellow-700 block mt-1"
          >
            O Judge0 captura apenas o que é impresso no stdout. Usar "return"
            sozinho não funciona.
          </Typography>
        </div>
        <Textarea
          fieldName="code"
          placeholder={getCodeExample()}
          rows={12}
          className="font-mono text-sm"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          💡 Dica: O último valor impresso (console.log/print) será o resultado
          capturado
        </Typography>
      </div>

      {/* Variáveis de Entrada (JSON) */}
      <div className="p-1">
        <FormControl variant="label">
          Variáveis de Entrada (JSON)
          <Typography
            variant="span"
            className="text-xs text-neutral-500 font-normal ml-2"
          >
            (opcional)
          </Typography>
        </FormControl>
        <Textarea
          fieldName="inputVariables"
          placeholder={
            '{\n  "x": {{$webhook.body.value1}},\n  "y": 20,\n  "items": {{$nodes.xxx.output.records}},\n  "name": {{$memory.userName}}\n}'
          }
          rows={6}
          className="font-mono text-sm"
        />
        <div className="space-y-1 mt-2">
          <Typography variant="span" className="text-xs text-neutral-600 block">
            JSON com variáveis que estarão disponíveis no código. Suporta
            variáveis dinâmicas.
          </Typography>
          <Typography
            variant="span"
            className="text-xs text-blue-600 block font-semibold"
          >
            💡 Use variáveis dinâmicas SEM aspas (funciona para qualquer tipo!)
          </Typography>
          <Typography variant="span" className="text-xs text-neutral-500 block">
            Exemplo:{' '}
            {`{"nome": {{$var}}, "items": {{$array}}, "config": {{$obj}}}`}
          </Typography>
        </div>
      </div>

      {/* Nome da Variável de Saída */}
      <div className="p-1">
        <FormControl variant="label">
          Nome da Variável de Saída
          <Typography
            variant="span"
            className="text-xs text-neutral-500 font-normal ml-2"
          >
            (opcional)
          </Typography>
        </FormControl>
        <Input
          type="text"
          fieldName="outputVariable"
          placeholder="codeResult"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Nome da variável para acessar o resultado (ex:{' '}
          {`{{$nodes.nodeId.output.codeResult}}`})
        </Typography>
      </div>

      {/* Opções Avançadas */}
      <div className="border-t pt-4 mt-4">
        <Typography variant="h5" className="font-semibold mb-3">
          ⚙️ Opções Avançadas
        </Typography>

        {/* Timeout */}
        <div className="p-1 mb-3">
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Timeout (segundos)
            </Typography>
          </FormControl>
          <Input
            type="number"
            fieldName="timeout"
            placeholder="5"
            min="1"
            max="30"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Tempo máximo de execução (1-30s). Padrão: 5s
          </Typography>
        </div>

        {/* Judge0 URL Customizada */}
        <div className="p-1">
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Judge0 URL Customizada
              <Typography
                variant="span"
                className="text-xs text-neutral-500 font-normal ml-2"
              >
                (opcional)
              </Typography>
            </Typography>
          </FormControl>
          <Input
            type="text"
            fieldName="judge0Url"
            placeholder="http://localhost:2358"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Deixe em branco para usar a instância local padrão
            (http://localhost:2358)
          </Typography>
        </div>
      </div>

      {/* Seção de Configuração de Memória */}
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

export function CodeExecutionNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: CodeExecutionNodeConfigProps) {
  // Estados para configuração de memória
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  // Carregar configuração de memória quando config mudar
  useEffect(() => {
    if (config?.memoryConfig?.items && config.memoryConfig.items.length > 0) {
      setMemoryItems(config.memoryConfig.items);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    const codeExecutionConfig: CodeExecutionConfig = {
      language: data.language as 'javascript' | 'python' | 'typescript',
      code: data.code,
      inputVariables: data.inputVariables || undefined,
      outputVariable: data.outputVariable || 'codeResult',
      timeout: data.timeout ? parseInt(data.timeout) : 5,
      judge0Url: data.judge0Url || undefined,
    };

    // Se configuração de memória estiver preenchida, adicionar ao codeExecutionConfig
    if (data.memoryName && data.memoryAction && data.memoryAction !== '') {
      // Processar TTL baseado no preset selecionado
      let ttl: number | undefined = undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      codeExecutionConfig.memoryConfig = {
        action: data.memoryAction as 'save' | 'fetch' | 'delete',
        memoryName: data.memoryName,
        items:
          data.memoryAction === 'save'
            ? (data.memoryItems as MemoryItem[])
            : undefined,
        ttl: ttl,
        defaultValue: data.memoryDefaultValue,
        saveMode:
          data.memoryAction === 'save'
            ? (data.memorySaveMode as 'overwrite' | 'append')
            : undefined,
      };
    }

    onSave(codeExecutionConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Code Execution"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={codeExecutionConfigSchema}
        onSubmit={handleSubmit}
      >
        <CodeExecutionFormFields
          config={config}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
        />
      </Form>
    </NodeConfigLayout>
  );
}
