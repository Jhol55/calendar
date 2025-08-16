type RequestData = BodyInit | null | Record<string, unknown>;

interface ApiResponse<T = unknown> {
  data: T | null;
  status: number;
  message: string;
}

interface ErrorResponse {
  message: string;
  success?: boolean;
  code?: number;
}

class APIError extends Error {
  status: number;
  response?: unknown;
  code?: number;

  constructor(
    message: string,
    status: number,
    response?: unknown,
    code?: number,
  ) {
    super(message);
    this.status = status;
    this.response = response;
    this.code = code;
  }
}

const defaultHeaders = {
  'Content-Type': 'application/json',
};

class FetchAPI {
  private baseURL: string;

  constructor() {
    const internalBaseURL = 'http://app:3000/api';
    const externalBaseURL = process.env.NEXT_PUBLIC_API_URL || '';

    this.baseURL =
      process.env.NODE_ENV === 'production'
        ? typeof window === 'undefined'
          ? internalBaseURL
          : externalBaseURL
        : 'http://localhost:3000/api';
  }

  private buildUrl(url: string): string {
    return this.baseURL + url;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = 8000,
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        cache: 'force-cache',
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }

  async get<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await this.fetchWithTimeout(this.buildUrl(url), {
      ...options,
      method: 'GET',
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    return this.handleResponse<T>(res);
  }

  async post<T = unknown>(
    url: string,
    data?: RequestData,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;

    const res = await this.fetchWithTimeout(this.buildUrl(url), {
      ...options,
      method: 'POST',
      headers: {
        ...(isFormData ? {} : defaultHeaders),
        ...options.headers,
      },
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async put<T = unknown>(
    url: string,
    data?: RequestData,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;

    const res = await this.fetchWithTimeout(this.buildUrl(url), {
      ...options,
      method: 'PUT',
      headers: {
        ...(isFormData ? {} : defaultHeaders),
        ...options.headers,
      },
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async delete<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await this.fetchWithTimeout(this.buildUrl(url), {
      ...options,
      method: 'DELETE',
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T = unknown>(
    response: Response,
  ): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData: ErrorResponse = await response.json().catch(() => ({
        message: response.statusText,
        code: response.status,
      }));

      throw new APIError(
        errorData.message || response.statusText,
        response.status,
        errorData,
        errorData.code,
      );
    }

    // 204 No Content → retorna null
    if (response.status === 204) {
      return {
        data: null,
        status: response.status,
        message: response.statusText,
      };
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : null;

    return {
      data,
      status: response.status,
      message: response.statusText,
    };
  }
}

export const api = new FetchAPI();
