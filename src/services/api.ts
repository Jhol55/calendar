type RequestData = BodyInit | null | Record<string, unknown>;

interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
  message: string;
  code: number;
}

interface ErrorResponse {
  message: string;
  success: boolean;
  code: number;
}

const headers = {
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

  async get<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.buildUrl(url), {
      ...options,
      method: 'GET',
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    return this.handleResponse(res);
  }

  async post<T = unknown>(
    url: string,
    data?: RequestData,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.buildUrl(url), {
      ...options,
      method: 'POST',
      headers: {
        ...headers,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse(res);
  }

  async put<T = unknown>(
    url: string,
    data?: RequestData,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.buildUrl(url), {
      ...options,
      method: 'PUT',
      headers: {
        ...headers,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse(res);
  }

  async delete<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.buildUrl(url), {
      ...options,
      method: 'DELETE',
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    return this.handleResponse(res);
  }

  private async handleResponse<T = unknown>(
    response: Response,
  ): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({}) as ErrorResponse);
      const errorMessage = errorData.message || response.statusText;
      throw new Error(`Request Error: ${response.status} - ${errorMessage}`);
    }
    return response.json();
  }
}

export const api = new FetchAPI();
