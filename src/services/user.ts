import crypto from 'crypto';
import { api } from './api';
import { JWTPayload } from 'jose';
import { FieldValues } from 'react-hook-form';

export class userService {
  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(60).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');
    return salt + hash;
  }

  public static verifyPassword(
    providedPassword: string,
    storedPassword: string,
  ): boolean {
    const salt = storedPassword.substring(0, 120);
    const originalHash = storedPassword.substring(120);
    const hash = crypto
      .pbkdf2Sync(providedPassword, salt, 100000, 64, 'sha512')
      .toString('hex');
    return hash === originalHash;
  }

  public static generateValidationCodeFromEmail(email: string) {
    const secret = process.env.SECRET_KEY;

    if (!secret) throw new Error('Secret key is required');

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(email);
    const hash = hmac.digest('hex');
    const number = parseInt(hash.substring(0, 15), 16);
    const code = number % 1000000;
    return code.toString().padStart(6, '0');
  }

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
