import { CodeExecutionConfig } from '@/components/layout/chatbot-flow/types';

/**
 * Substitui variáveis em um JSON template garantindo formato válido
 * Adiciona aspas automaticamente em strings quando necessário
 */
function replaceVariablesInJSON(
  jsonTemplate: string,
  context: Record<string, unknown>,
): Record<string, unknown> {
  // Substituir variáveis usando uma regex que detecta o contexto
  const replaced = jsonTemplate.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    try {
      const cleanPath = path.trim();
      const parts = cleanPath.split('.');

      let value: unknown = context;
      for (const part of parts) {
        // Type guard para verificar se value é um objeto indexável
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          part in value
        ) {
          // Type assertion: sabemos que value é um objeto indexável
          value = (value as Record<string, unknown>)[part];
        } else {
          return match; // Variável não encontrada
        }
      }

      if (value === null || value === undefined) {
        return match;
      }

      // SEMPRE usar JSON.stringify para garantir formato válido
      // Isso adiciona aspas em strings, formata objetos/arrays corretamente
      return JSON.stringify(value);
    } catch {
      return match;
    }
  });

  // Agora parsear o JSON resultante
  const parsed = JSON.parse(replaced);

  // Garantir que o resultado é um objeto
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  // Se não for um objeto, retornar objeto vazio ou lançar erro
  throw new Error('JSON template deve resultar em um objeto');
}

// Mapeamento de linguagens para IDs do Judge0
// Ref: https://ce.judge0.com/languages
const LANGUAGE_IDS = {
  javascript: 63, // Node.js
  python: 71, // Python 3
};

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  cpu_extra_time?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  stack_limit?: number;
  max_processes_and_or_threads?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  enable_per_process_and_thread_memory_limit?: boolean;
  max_file_size?: number;
}

interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

/**
 * Processa o Code Execution Node
 *
 * Retorna diretamente o resultado com a estrutura:
 * {
 *   [outputVariable]: parsedOutput, // Ex: codeResult: [...]
 *   success: boolean,
 *   error: string | null,
 *   executionTime?: string,
 *   memory?: number,
 *   language: string,
 *   status?: string
 * }
 */
export async function processCodeExecutionNode(
  config: CodeExecutionConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableContext: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    console.log('🔷 [CODE-EXECUTION] Processando Code Execution Node');
    console.log('🔷 [CODE-EXECUTION] Config:', JSON.stringify(config, null, 2));
    console.log(
      '🔷 [CODE-EXECUTION] Variable Context:',
      JSON.stringify(variableContext, null, 2),
    );

    // 1. Validar configuração
    if (!config.code || !config.language) {
      throw new Error('Código e linguagem são obrigatórios');
    }

    // 2. Resolver variáveis de entrada
    let inputVars: Record<string, unknown> = {};
    if (config.inputVariables) {
      console.log(
        '🔷 [CODE-EXECUTION] Original input vars:',
        config.inputVariables,
      );

      try {
        // Usar replaceVariablesInJSON para garantir JSON válido
        // A função já retorna Record<string, unknown>, então não precisa de type assertion
        inputVars = replaceVariablesInJSON(
          config.inputVariables,
          variableContext as Record<string, unknown>,
        );

        console.log(
          '🔷 [CODE-EXECUTION] Resolved input vars:',
          JSON.stringify(inputVars, null, 2),
        );
      } catch (error) {
        console.error(
          '🔴 [CODE-EXECUTION] Erro ao resolver inputVariables:',
          error,
        );
        console.error('🔴 [CODE-EXECUTION] Template:', config.inputVariables);
        throw new Error(
          `Erro ao processar inputVariables: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        );
      }
    }

    // 3. Preparar o código com as variáveis de entrada
    console.log(
      '🔷 [CODE-EXECUTION] inputVars antes de prepareCode:',
      JSON.stringify(inputVars, null, 2),
    );
    const preparedCode = prepareCodeWithVariables(
      config.code,
      inputVars,
      config.language,
    );

    console.log('🔷 [CODE-EXECUTION] Prepared code:');
    console.log('--- CODE START ---');
    console.log(preparedCode);
    console.log('--- CODE END ---');

    // 4. Executar no Judge0
    const judge0Url = config.judge0Url || 'http://localhost:2358';
    const languageId = LANGUAGE_IDS[config.language];

    console.log(`🔷 [CODE-EXECUTION] Enviando para Judge0: ${judge0Url}`);
    console.log(`🔷 [CODE-EXECUTION] Language ID: ${languageId}`);

    // Codificar o código em base64 para evitar problemas com UTF-8
    const base64Code = Buffer.from(preparedCode, 'utf-8').toString('base64');

    const submission: Judge0Submission = {
      source_code: base64Code,
      language_id: languageId,
      cpu_time_limit: config.timeout || 5,
      wall_time_limit: (config.timeout || 5) + 1,
    };

    console.log('🔷 [CODE-EXECUTION] Code encoded in base64');

    // Criar submission com base64_encoded=true
    const createResponse = await fetch(
      `${judge0Url}/submissions?base64_encoded=true&wait=true`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submission),
      },
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('🔴 [CODE-EXECUTION] Erro ao criar submission:', errorText);
      throw new Error(
        `Judge0 API error: ${createResponse.status} - ${errorText}`,
      );
    }

    const result: Judge0Result = await createResponse.json();

    console.log(
      '🔷 [CODE-EXECUTION] Judge0 Result:',
      JSON.stringify(result, null, 2),
    );

    // Verificar se há erro no resultado
    if (!result.status) {
      console.error('🔴 [CODE-EXECUTION] Judge0 retornou erro:', result);
      throw new Error(`Judge0 error: ${JSON.stringify(result)}`);
    }

    // 5. Processar resultado
    const statusId = result.status.id;
    const statusDescription = result.status.description;

    // Status IDs do Judge0:
    // 3 = Accepted (sucesso)
    // 4 = Wrong Answer
    // 5 = Time Limit Exceeded
    // 6 = Compilation Error
    // 7-12 = Runtime Errors
    // 13 = Internal Error
    // 14 = Exec Format Error

    let output = null;
    let error = null;
    let success = false;

    // Decodificar stdout/stderr/compile_output que vêm em base64
    const decodeBase64 = (str: string | null | undefined): string | null => {
      if (!str) return null;
      try {
        return Buffer.from(str, 'base64').toString('utf-8');
      } catch {
        return str; // Se falhar, retornar como está
      }
    };

    if (statusId === 3) {
      // Sucesso
      success = true;
      output = decodeBase64(result.stdout)?.trim() || null;
    } else if (statusId === 6) {
      // Erro de compilação
      error = decodeBase64(result.compile_output) || 'Erro de compilação';
    } else if (result.stderr) {
      // Runtime error
      error = decodeBase64(result.stderr)?.trim() || null;
    } else {
      // Outro erro
      error = result.message || statusDescription || 'Erro desconhecido';
    }

    console.log(
      `✅ [CODE-EXECUTION] Execução concluída - Status: ${statusDescription}`,
    );
    console.log(`✅ [CODE-EXECUTION] Output (raw): ${output}`);
    console.log(`✅ [CODE-EXECUTION] Error: ${error}`);

    // 6. Tentar parsear output como JSON se possível
    let parsedOutput = output;
    if (output && typeof output === 'string') {
      // Tentar parsear como JSON puro primeiro
      try {
        parsedOutput = JSON.parse(output);
        console.log(`✅ [CODE-EXECUTION] Output parseado como JSON puro`);
      } catch {
        // Se falhar, tentar converter formato JavaScript para JSON
        console.log(
          `⚠️ [CODE-EXECUTION] Tentando converter formato JavaScript para JSON...`,
        );
        try {
          let jsFormatted = output;

          // 1. Remover espaços e quebras de linha desnecessários
          jsFormatted = jsFormatted.trim();

          // 2. Substituir [Array] por [] (arrays aninhados não expandidos)
          jsFormatted = jsFormatted.replace(/\[\s*\[Array\]\s*\]/g, '[]');

          // 3. Adicionar aspas em chaves de objetos sem aspas (regex cuidadoso)
          // Detecta: palavra: (sem aspas antes da palavra)
          jsFormatted = jsFormatted.replace(
            /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
            '$1"$2":',
          );

          // 4. Substituir aspas simples por duplas (cuidado com aspas dentro de strings)
          // Detecta: ': ou ':
          jsFormatted = jsFormatted.replace(/:\s*'([^']*)'/g, ': "$1"');

          // 5. Substituir aspas simples em arrays
          jsFormatted = jsFormatted.replace(/\[\s*'([^']*)'/g, '["$1"');
          jsFormatted = jsFormatted.replace(/',\s*'/g, '", "');
          jsFormatted = jsFormatted.replace(/'\s*\]/g, '"]');

          console.log(
            `🔹 [CODE-EXECUTION] Convertido para:`,
            jsFormatted.substring(0, 200),
          );

          // Tentar parsear o resultado convertido
          parsedOutput = JSON.parse(jsFormatted);
          console.log(`✅ [CODE-EXECUTION] Output convertido com sucesso!`);
        } catch (convertError) {
          console.log(`❌ [CODE-EXECUTION] Falha na conversão:`, convertError);
          console.log(`✅ [CODE-EXECUTION] Mantendo como string`);
          parsedOutput = output;
        }
      }
    }

    // 7. Preparar resultado final
    const outputVariable = config.outputVariable || 'codeResult';

    // Retornar diretamente sem wrapper "result" redundante
    // Agora o caminho fica: {{$nodes.nodeId.output.codeResult.0}}
    return {
      [outputVariable]: parsedOutput,
      success,
      error,
      executionTime: result.time,
      memory: result.memory,
      language: config.language,
      status: statusDescription,
    };
  } catch (error) {
    console.error('🔴 [CODE-EXECUTION] Erro fatal:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    const outputVariable = config.outputVariable || 'codeResult';

    // Retornar diretamente sem wrapper "result" redundante
    return {
      [outputVariable]: null,
      success: false,
      error: errorMessage,
      language: config.language,
    };
  }
}

/**
 * Prepara o código injetando as variáveis de entrada
 */
function prepareCodeWithVariables(
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputVars: Record<string, any>,
  language: 'javascript' | 'python',
): string {
  const hasInputVars = Object.keys(inputVars).length > 0;

  if (language === 'javascript') {
    // Override do console.log para fazer JSON.stringify automático em objetos/arrays
    const consoleOverride = `
// Auto JSON.stringify para objetos/arrays
const _log = console.log;
console.log = function(...args) {
  const processed = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch {
        return arg;
      }
    }
    return arg;
  });
  _log(...processed);
};
`.trim();

    // Para JavaScript, declarar as variáveis no início
    const varDeclarations = hasInputVars
      ? Object.entries(inputVars)
          .map(([key, value]) => {
            const serializedValue = JSON.stringify(value);
            return `const ${key} = ${serializedValue};`;
          })
          .join('\n')
      : '';

    const parts = [consoleOverride];
    if (varDeclarations) parts.push(varDeclarations);
    parts.push(code);

    return parts.join('\n\n');
  } else if (language === 'python') {
    // Override do print para fazer json.dumps automático em dicts/lists
    const printOverride = `
import json
_print = print
def print(*args, **kwargs):
    processed = []
    for arg in args:
        if isinstance(arg, (dict, list, tuple)):
            try:
                processed.append(json.dumps(arg, ensure_ascii=False))
            except:
                processed.append(str(arg))
        else:
            processed.append(arg)
    _print(*processed, **kwargs)
`.trim();

    // Para Python, declarar as variáveis no início
    const varDeclarations = hasInputVars
      ? Object.entries(inputVars)
          .map(([key, value]) => {
            const serializedValue = JSON.stringify(value);
            return `${key} = ${serializedValue}`;
          })
          .join('\n')
      : '';

    const parts = [printOverride];
    if (varDeclarations) parts.push(varDeclarations);
    parts.push(code);

    return parts.join('\n\n');
  }

  return code;
}
