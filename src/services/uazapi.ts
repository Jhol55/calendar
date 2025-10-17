import { api } from './api';
import { ApiError } from './api';

export async function getInstances() {
  try {
    const response = await api.get(`/uazapi/admin/instance/all`);
    return response;
  } catch (error) {
    console.error('Erro ao buscar instâncias', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText: err?.response?.statusText ?? 'Erro ao buscar instâncias',
      headers: err?.response?.headers ?? {},
    };
  }
}

export async function connectInstance({ token }: { token: string }) {
  try {
    const response = await api.post(`/uazapi/user/instance/connect`, {
      headers: { token: `${token}` },
    });
    return response;
  } catch (error) {
    console.error('Erro ao conectar instância', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText: err?.response?.statusText ?? 'Erro ao conectar instância',
      headers: err?.response?.headers ?? {},
    };
  }
}

export async function getInstanceStatus({ token }: { token: string }) {
  try {
    const response = await api.get(`/uazapi/user/instance/status`, {
      headers: { token: `${token}` },
    });
    return response;
  } catch (error) {
    console.error('Erro ao buscar status da instância', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText:
        err?.response?.statusText ?? 'Erro ao buscar status da instância',
      headers: err?.response?.headers ?? {},
    };
  }
}

export async function deleteInstance({ token }: { token: string }) {
  try {
    const response = await api.delete(`/uazapi/user/instance`, {
      headers: { token: `${token}` },
    });
    return response;
  } catch (error) {
    console.error('Erro ao deletar instância', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText: err?.response?.statusText ?? 'Erro ao deletar instância',
      headers: err?.response?.headers ?? {},
    };
  }
}
