/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WebhookJobData } from '@/services/queue';
import { replaceVariables } from '../variable-replacer';
import { parseJSONRecursively } from '../json-parser';

interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  bodyType?: 'json' | 'form' | 'text';
  timeout?: number;
  followRedirects?: boolean;
  saveResponse?: boolean;
  responseVariable?: string;
  memoryConfig?: any;
}

/**
 * Processa um nó de requisição HTTP (HTTP Request Node)
 *
 * Suporta:
 * - Todos os métodos HTTP (GET, POST, PUT, PATCH, DELETE)
 * - Headers customizados
 * - Body em JSON, form-urlencoded ou texto
 * - Timeout configurável
 * - Substituição de variáveis em URL, headers e body
 * - Parsing automático de JSON (recursivo)
 * - Correção de JSON malformado
 */
export async function processHttpRequestNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
  variableContext: any,
  processNodeMemory?: (
    config: any,
    execId: string,
    context: any,
  ) => Promise<any>,
): Promise<unknown> {
  console.log('🌐 Processing HTTP request node');

  const httpRequestConfig = node.data?.httpRequestConfig as
    | HttpRequestConfig
    | undefined;

  if (!httpRequestConfig) {
    throw new Error('HTTP request configuration not found');
  }

  const {
    url,
    method,
    headers,
    body,
    bodyType,
    timeout,
    followRedirects,
    saveResponse,
    responseVariable,
  } = httpRequestConfig;

  if (!url || !method) {
    throw new Error('URL and method are required');
  }

  try {
    console.log(`📤 Making ${method} request to ${url}`);

    console.log('🔍 HTTP Request variable context:', {
      hasLoop: !!variableContext.$loop,
      availableNodes: Object.keys(variableContext.$nodes),
    });

    // Substituir variáveis na URL
    const resolvedUrl = replaceVariables(url, variableContext);
    console.log(`📝 Original URL: ${url}`);
    console.log(`📝 Resolved URL: ${resolvedUrl}`);

    // Preparar headers
    const requestHeaders: Record<string, string> = {};
    if (headers && headers.length > 0) {
      headers.forEach((header) => {
        if (header.key && header.value) {
          const resolvedKey = replaceVariables(header.key, variableContext);
          const resolvedValue = replaceVariables(header.value, variableContext);
          requestHeaders[resolvedKey] = resolvedValue;
        }
      });
    }

    // Preparar body se necessário
    let requestBody: string | undefined = undefined;
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const resolvedBody = replaceVariables(body, variableContext);

      // Definir Content-Type baseado no bodyType
      if (bodyType === 'json') {
        requestHeaders['Content-Type'] = 'application/json';

        // Se replaceVariables já retornou um objeto parseado, stringificar
        if (typeof resolvedBody === 'object' && resolvedBody !== null) {
          console.log(
            '✅ replaceVariables returned parsed object, stringifying for HTTP request',
          );
          requestBody = JSON.stringify(resolvedBody);
        }
        // Se é string, validar se é JSON válido
        else if (typeof resolvedBody === 'string') {
          try {
            JSON.parse(resolvedBody);
            requestBody = resolvedBody;
          } catch {
            throw new Error('Invalid JSON in request body');
          }
        } else {
          throw new Error('Invalid body type for JSON request');
        }
      } else if (bodyType === 'form') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = String(resolvedBody);
      } else {
        // text
        requestHeaders['Content-Type'] = 'text/plain';
        requestBody = String(resolvedBody);
      }
    }

    console.log(`📦 Request headers:`, requestHeaders);
    console.log(`📦 Request body:`, requestBody);

    // Fazer a requisição HTTP
    const controller = new AbortController();
    const timeoutId = timeout
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      const response = await fetch(resolvedUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
        redirect: followRedirects !== false ? 'follow' : 'manual',
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Ler resposta
      const responseText = await response.text();
      console.log(`📄 Raw response text:`, responseText);
      console.log(`📄 Raw response text type:`, typeof responseText);

      let responseData: unknown;

      // Tentar parsear como JSON recursivamente até não ser mais string
      responseData = responseText;
      let parseAttempts = 0;
      const maxAttempts = 3; // Prevenir loop infinito

      while (typeof responseData === 'string' && parseAttempts < maxAttempts) {
        try {
          const parsed = JSON.parse(responseData);
          console.log(
            `🔄 Parse attempt ${parseAttempts + 1}: success, type = ${typeof parsed}`,
          );
          responseData = parsed;
          parseAttempts++;
        } catch {
          console.log(`🔄 Parse attempt ${parseAttempts + 1}: failed`);

          // Tentar corrigir JSONs malformados comuns apenas na primeira tentativa
          if (parseAttempts === 0 && typeof responseData === 'string') {
            console.log(`🔧 Attempting to fix malformed JSON...`);

            // Tentar corrigir padrões comuns de JSON malformado
            let fixedJson = responseData;

            // Corrigir: { "data:" "success" } -> { "data": "success" }
            fixedJson = fixedJson.replace(
              /"([^"]+):"\s+"([^"]+)"/g,
              '"$1": "$2"',
            );

            // Corrigir: :" " -> ": " (espaço extra após dois pontos)
            fixedJson = fixedJson.replace(/:\s*"\s+/g, ': "');

            try {
              const fixedParsed = JSON.parse(fixedJson);
              console.log(`✅ Fixed JSON successfully!`);
              responseData = fixedParsed;
              parseAttempts++;
              continue; // Tentar parsear novamente
            } catch {
              console.log(`❌ Could not fix malformed JSON, keeping as string`);
            }
          }

          break; // Não é JSON válido, manter como string
        }
      }

      console.log(`📋 Response status: ${response.status}`);
      console.log(`📋 Final response data:`, responseData);
      console.log(`📋 Final response data type:`, typeof responseData);
      console.log(`📋 Total parse attempts:`, parseAttempts);

      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        throw new Error(
          `HTTP request failed with status ${response.status}: ${responseText}`,
        );
      }

      // Parsear recursivamente strings JSON na resposta
      const parsedResponseData = parseJSONRecursively(responseData);

      const result = {
        type: 'http_request',
        status: 'success',
        statusCode: response.status,
        url: resolvedUrl,
        method,
        response: parsedResponseData,
        // Se saveResponse estiver ativo, incluir em variável específica
        ...(saveResponse && responseVariable
          ? { [responseVariable]: parsedResponseData }
          : {}),
      };

      // Processar memória se configurada
      let memoryResult = undefined;
      if (httpRequestConfig.memoryConfig && processNodeMemory) {
        const httpVariableContext = {
          ...variableContext,
          $node: {
            ...variableContext.$node,
            output: result,
          },
        };

        memoryResult = await processNodeMemory(
          httpRequestConfig.memoryConfig,
          executionId,
          httpVariableContext,
        );
      }

      console.log(
        `✅ HTTP request completed successfully to ${resolvedUrl} from node ${node.id}`,
      );

      return {
        ...result,
        memoryResult,
      };
    } catch (fetchError) {
      if (timeoutId) clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeout}ms`);
      }

      throw fetchError;
    }
  } catch (error) {
    console.error(`❌ Error making HTTP request:`, error);
    throw error;
  }
}
