'use server';

import { authService } from '@/services/auth';
import { sessionService } from '@/services/session';
import { RESPONSES } from '@/constants/responses';
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
      success: RESPONSES.LOGIN.USER_NOT_FOUND.success,
      message: RESPONSES.LOGIN.USER_NOT_FOUND.message,
      code: RESPONSES.LOGIN.USER_NOT_FOUND.code,
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
      success: RESPONSES.LOGIN.SUCCESS.success,
      message: RESPONSES.LOGIN.SUCCESS.message,
      code: RESPONSES.LOGIN.SUCCESS.code,
    };
  }

  return {
    success: RESPONSES.LOGIN.INVALID_PASSWORD.success,
    message: RESPONSES.LOGIN.INVALID_PASSWORD.message,
    code: RESPONSES.LOGIN.INVALID_PASSWORD.code,
    field: 'email',
  };
}
