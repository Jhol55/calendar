import { api, ApiError } from './api';
import { JWTPayload } from 'jose';

export async function verifyConfirmedEmailStatus(session: JWTPayload) {
  if (!session) return;

  const { email } = session.user as { email: string };

  try {
    const response = await api.get(`/confirm?email=${email}`);
    return response;
  } catch (error) {
    console.error('Erro ao consultar usuário', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText: err?.response?.statusText ?? 'Erro ao consultar usuário',
      headers: err?.response?.headers ?? {},
    };
  }
}

export async function getUser() {
  try {
    const response = await api.get('/user');
    return response;
  } catch (error) {
    console.error('Erro ao consultar usuário', error);
    const err = error as ApiError;
    return {
      data: err?.response?.data ?? null,
      status: err?.response?.status ?? 500,
      success: false,
      statusText: err?.response?.statusText ?? 'Erro ao buscar usuário',
      headers: err?.response?.headers ?? {},
    };
  }
}
