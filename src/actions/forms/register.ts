'use server';

import { deleteSession, createSession } from '@/utils/security/session';
import {
  hashPassword,
  generateValidationCodeFromEmail,
} from '@/utils/security/auth';
import { prisma } from '@/services/prisma';
import { registerFormSchema } from '@/components/features/forms/register/register.schema';

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
      success: false,
      message: 'Este e-mail já está em uso',
      code: 409,
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
    password: await hashPassword(data.password as string),
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

  await deleteSession();

  // Novo usuário não tem plano ainda (confirmed: false, hasPlan: false)
  await createSession(
    {
      email: data.email as string,
      remember: true,
    },
    {
      confirmed: false,
      hasPlan: false,
    },
  );

  console.log(await generateValidationCodeFromEmail(data.email as string));

  return {
    success: true,
    message: 'Registro realizado com sucesso',
    code: 201,
  };
}
