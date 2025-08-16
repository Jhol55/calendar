import { api } from './api';
import { JWTPayload } from 'jose';

export async function verifyConfirmedEmailStatus(session: JWTPayload) {
  if (!session) return;

  const { email } = session.user as { email: string };

  try {
    const response = await api.get(`/confirm?email=${email}`);
    return response;
  } catch (error) {
    console.error('Erro ao consultar usuário', error);
    return {
      data: null,
      status: 500,
      success: false,
      statusText: 'Erro ao consultar usuário',
      headers: {},
      config: {},
    };
  }
}

export async function getUser() {
  try {
    const response = await api.get('/user');
    return response;
  } catch (error) {
    console.error('Erro ao consultar usuário', error);
    return {
      data: null,
      status: 500,
      success: false,
      statusText: 'Erro ao buscar usuário',
      headers: {},
      config: {},
    };
  }
}
