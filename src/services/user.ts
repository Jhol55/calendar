import { api } from './api';
import { JWTPayload } from 'jose';
import { FieldValues } from 'react-hook-form';

export class userService {
  public static async verifyConfirmedEmailStatus(session: JWTPayload) {
    if (!session) return;
    const { email } = session.user as { email: string };
    try {
      const response = await api.get(`/confirm?email=${email}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao consultar usuário', error);
    }
  }

  public static async confirmEmail(data: FieldValues) {
    try {
      const response = await api.post('/confirm', data);
      return response.data;
    } catch (error) {
      console.error('Erro ao confirmar o email do usuário', error);
    }
  }

  public static async register(data: FieldValues) {
    try {
      const response = await api.post('/register', data);
      return response.data;
    } catch (error) {
      console.error('Erro ao registrar usuário', error);
    }
  }

  public static async login(data: FieldValues) {
    try {
      const response = await api.post('/login', data);
      return response.data;
    } catch (error) {
      console.error('Erro ao logar usuário', error);
    }
  }

  public static async getUser() {
    try {
      const response = await api.get('/user');
      return response.data;
    } catch (error) {
      console.error('Erro ao consultar usuário', error);
    }
  }
}
