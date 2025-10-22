import { CodeExecutionConfig } from '@/components/layout/chatbot-flow/types';
import { replaceVariables } from './variable-replacer';

// Mapeamento de linguagens para IDs do Judge0
// Ref: https://ce.judge0.com/languages
const LANGUAGE_IDS = {
  javascript: 63, // Node.js
  typescript: 74, // TypeScript
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
 */
export async function processCodeExecutionNode(
  config: CodeExecutionConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableContext: any,
): Promise<{
  success: boolean;
  output: string | null;
  error: string | null;
  executionTime?: string;
  memory?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
}> {
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
    let inputVars: Record<string, any> = {};
    if (config.inputVariables) {
      const resolvedInputVars = replaceVariables(
        config.inputVariables,
        variableContext,
      );
      console.log(
        '🔷 [CODE-EXECUTION] Original input vars:',
        config.inputVariables,
      );
      console.log(
        '🔷 [CODE-EXECUTION] Resolved input vars:',
        resolvedInputVars,
      );
      console.log(
        '🔷 [CODE-EXECUTION] Type of resolved:',
        typeof resolvedInputVars,
      );

      // Se replaceVariables já retornou um objeto (por causa do parse interno), usar diretamente
      if (typeof resolvedInputVars === 'object' && resolvedInputVars !== null) {
        inputVars = resolvedInputVars;

        // Verificar se ainda há variáveis não resolvidas (converter para string para checar)
        const jsonString = JSON.stringify(resolvedInputVars);
        const hasUnresolvedVars = /\{\{[^}]+\}\}/.test(jsonString);
        if (hasUnresolvedVars) {
          console.error(
            '🔴 [CODE-EXECUTION] Variáveis dinâmicas não foram resolvidas!',
          );
          console.error(
            '🔴 [CODE-EXECUTION] Objeto com variáveis:',
            resolvedInputVars,
          );
          console.error(
            '🔴 [CODE-EXECUTION] Contexto disponível:',
            Object.keys(variableContext),
          );
          throw new Error(
            `Variáveis dinâmicas não foram resolvidas. Verifique se os nodes existem no fluxo. Variável não resolvida: ${jsonString.match(/\{\{[^}]+\}\}/)?.[0]}`,
          );
        }
      } else {
        // É uma string, precisa fazer parse
        const resolvedString = String(resolvedInputVars);

        // Verificar se ainda há variáveis não resolvidas
        const hasUnresolvedVars = /\{\{[^}]+\}\}/.test(resolvedString);
        if (hasUnresolvedVars) {
          console.error(
            '🔴 [CODE-EXECUTION] Variáveis dinâmicas não foram resolvidas!',
          );
          console.error(
            '🔴 [CODE-EXECUTION] String com variáveis:',
            resolvedString,
          );
          console.error(
            '🔴 [CODE-EXECUTION] Contexto disponível:',
            Object.keys(variableContext),
          );
          throw new Error(
            `Variáveis dinâmicas não foram resolvidas. Verifique se os nodes existem no fluxo. Variável não resolvida: ${resolvedString.match(/\{\{[^}]+\}\}/)?.[0]}`,
          );
        }

        try {
          inputVars = JSON.parse(resolvedString);
        } catch (error) {
          console.error(
            '🔴 [CODE-EXECUTION] Erro ao parsear inputVariables:',
            error,
          );
          console.error(
            '🔴 [CODE-EXECUTION] String que causou erro:',
            resolvedString,
          );
          throw new Error(
            `Erro ao parsear inputVariables: ${error instanceof Error ? error.message : 'JSON inválido'}. Valor recebido: ${resolvedString.substring(0, 200)}`,
          );
        }
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
    const finalResult = {
      [outputVariable]: parsedOutput,
      success,
      error,
      executionTime: result.time,
      memory: result.memory,
      language: config.language,
      status: statusDescription,
    };

    return {
      success,
      output: parsedOutput, // Usar output parseado
      error,
      executionTime: result.time || undefined,
      memory: result.memory || undefined,
      result: finalResult,
    };
  } catch (error) {
    console.error('🔴 [CODE-EXECUTION] Erro fatal:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    const outputVariable = config.outputVariable || 'codeResult';

    return {
      success: false,
      output: null,
      error: errorMessage,
      result: {
        [outputVariable]: null,
        success: false,
        error: errorMessage,
        language: config.language,
      },
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
  language: 'javascript' | 'typescript' | 'python',
): string {
  if (Object.keys(inputVars).length === 0) {
    return code;
  }

  if (language === 'javascript' || language === 'typescript') {
    // Para JS/TS, declarar as variáveis no início
    const varDeclarations = Object.entries(inputVars)
      .map(([key, value]) => {
        const serializedValue = JSON.stringify(value);
        return `const ${key} = ${serializedValue};`;
      })
      .join('\n');

    return `${varDeclarations}\n\n${code}`;
  } else if (language === 'python') {
    // Para Python, declarar as variáveis no início
    const varDeclarations = Object.entries(inputVars)
      .map(([key, value]) => {
        const serializedValue = JSON.stringify(value);
        // Python não aceita JSON.stringify diretamente, então usar repr ou json.loads
        return `${key} = ${serializedValue}`;
      })
      .join('\n');

    // Adicionar import json se houver objetos/arrays
    const needsJson = Object.values(inputVars).some(
      (v) => typeof v === 'object' && v !== null,
    );
    const importStatement = needsJson ? 'import json\n' : '';

    return `${importStatement}${varDeclarations}\n\n${code}`;
  }

  return code;
}
