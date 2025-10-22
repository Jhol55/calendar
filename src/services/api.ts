/**
 * ⚠️ IMPORTANTE: Este serviço é APENAS para chamadas a APIs EXTERNAS!
 *
 * NÃO use este serviço para:
 * ❌ Chamar endpoints internos (/api/*)
 * ❌ Buscar dados do banco de dados
 * ❌ Operações CRUD internas
 *
 * Para operações internas, use:
 * ✅ Server Actions (src/actions/*) que acessam Prisma diretamente
 * ✅ React Query Hooks (src/lib/react-query/hooks/*) que chamam Server Actions
 *
 * Use este serviço APENAS para:
 * ✅ Chamadas a APIs externas de terceiros (ex: OpenAI, Judge0, etc.)
 * ✅ Integrações com serviços externos
 *
 * Exemplos válidos:
 * - api.post('https://api.openai.com/v1/chat/completions', ...)
 * - api.get('https://api.judge0.com/submissions', ...)
 *
 * Exemplos INVÁLIDOS:
 * - api.get('/chatbot-flows') ❌ Use useWorkflows() hook
 * - api.post('/database/add-row') ❌ Use useInsertTableRow() hook
 */

// Define interfaces para as respostas e configurações
interface ApiResponse {
  data: object;
  status: number;
  success: boolean;
  statusText: string;
  headers: Record<string, string>;
  config: RequestInit;
}

export interface ApiErrorResponse {
  data: object;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError extends Error {
  response?: ApiErrorResponse;
}

// Estende a interface RequestInit para incluir headers de forma mais flexível
interface ApiConfig extends RequestInit {
  headers?: Record<string, string>;
}

const internalBaseURL = 'http://app:3000/api';
const externalBaseURL = process.env.NEXT_PUBLIC_API_URL || '';

const baseURL =
  process.env.NODE_ENV === 'production'
    ? typeof window === 'undefined'
      ? internalBaseURL
      : externalBaseURL
    : 'http://localhost:3000/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const request = async (
  method: HttpMethod,
  url: string,
  data: unknown = null,
  config: ApiConfig = {},
): Promise<ApiResponse> => {
  const finalURL = `${baseURL}${url}`;
  const headers = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  const options: RequestInit = {
    method,
    headers,
    ...config,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(finalURL, options);

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      // O corpo da resposta não é um JSON válido ou está vazio.
    }

    if (!response.ok) {
      const error: ApiError = new Error(
        response.statusText || 'Request Failed',
      );
      error.response = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      };
      throw error;
    }

    return {
      data: responseData,
      status: response.status,
      success: response.ok,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config: options,
    };
  } catch (error) {
    console.error(
      `[API Fetch Error] ${method} ${url}:`,
      (error as ApiError).response || (error as Error).message,
    );
    throw error;
  }
};

export const api = {
  get: (url: string, config?: ApiConfig) => request('GET', url, null, config),
  post: (url: string, data: unknown, config?: ApiConfig) =>
    request('POST', url, data, config),
  put: (url: string, data: unknown, config?: ApiConfig) =>
    request('PUT', url, data, config),
  patch: (url: string, data: unknown, config?: ApiConfig) =>
    request('PATCH', url, data, config),
  delete: (url: string, config?: ApiConfig) =>
    request('DELETE', url, null, config),
};
