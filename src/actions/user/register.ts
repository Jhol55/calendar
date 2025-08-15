'use server';

import { sessionService } from '@/services/session';
import { authService } from '@/services/auth';
import { prisma } from '@/lib/prisma';
import { RESPONSES } from '@/constants/responses';
import { registerFormSchema } from '@/features/forms/register/register.schema';

type RegisterResponse = {
  success: boolean;
  message?: string;
  code?: number;
  field?: string;
};

export async function register(formData: FormData): Promise<RegisterResponse> {
  const data = {
    email: formData.get('email'),
    password: formData.get('password'),
    repeatPassword: formData.get('repeatPassword'),
  };

  const validationResult = registerFormSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.errors[0].message,
      code: 400,
      field: validationResult.error.errors[0].path[0] as string,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email as string },
    select: { email: true },
  });

  if (existingUser) {
    return {
      success: RESPONSES.REGISTER.USER_ALREADY_EXISTS.success,
      message: RESPONSES.REGISTER.USER_ALREADY_EXISTS.message,
      code: RESPONSES.REGISTER.USER_ALREADY_EXISTS.code,
      field: 'email',
    };
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: 'superadmin',
    },
  });

  const encryptedData = {
    email: data.email as string,
    password: await authService.hashPassword(data.password as string),
  };

  try {
    await prisma.user.create({
      data: {
        ...encryptedData,
        role: !existingSuperAdmin ? 'superadmin' : 'user',
      },
    });
  } catch (error) {
    console.error('Erro na requisição:', error);
    return {
      success: false,
      message: 'Ocorreu um erro ao registrar o usuário.',
      code: 500,
    };
  }

  await sessionService.deleteSession();

  const sessionData = {
    email: data.email as string,
    remember: true,
  };
  await sessionService.createSession(sessionData);

  console.log(
    await authService.generateValidationCodeFromEmail(data.email as string),
  );

  return {
    success: RESPONSES.REGISTER.SUCCESS.success,
    message: RESPONSES.REGISTER.SUCCESS.message,
    code: RESPONSES.REGISTER.SUCCESS.code,
  };
}
