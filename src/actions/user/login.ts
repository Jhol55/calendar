'use server';

import { authService } from '@/services/auth';
import { sessionService } from '@/services/session';
import { prisma } from '@/lib/prisma';
import { loginFormSchema } from '@/features/forms/login/login.schema';

type LoginResponse = {
  success: boolean;
  message?: string;
  code?: number;
  field?: string;
};

export async function login(formData: FormData): Promise<LoginResponse> {
  const data = {
    email: formData.get('email'),
    password: formData.get('password'),
    remember: formData.get('remember') === 'true',
  };

  const validationResult = loginFormSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.errors[0].message,
      code: 400,
      field: validationResult.error.errors[0].path[0] as string,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: data.email as string },
    select: { password: true },
  });

  if (!user) {
    return {
      success: false,
      message: 'Email ou senha inválidos',
      code: 404,
      field: 'email',
    };
  }

  const success = await authService.verifyPassword(
    data.password as string,
    user.password,
  );

  if (success) {
    await sessionService.createSession({
      email: data.email as string,
      remember: data.remember as boolean,
    });

    return {
      success: true,
      message: 'Login realizado com sucesso',
      code: 200,
    };
  }

  return {
    success: false,
    message: 'Email ou senha inválidos',
    code: 401,
    field: 'email',
  };
}
