'use server';

import { verifyPassword } from '@/utils/security/auth';
import { createSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';
import { loginFormSchema } from '@/components/features/forms/login/login.schema';

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
    select: {
      password: true,
      confirmed: true,
      planId: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    return {
      success: false,
      message: 'Email ou senha inválidos',
      code: 404,
      field: 'email',
    };
  }

  const success = await verifyPassword(data.password as string, user.password);

  if (success) {
    // Calcular hasPlan
    let hasPlan = false;
    if (user.subscription) {
      const now = new Date();
      const isTrialing =
        user.subscription.status === 'trialing' ||
        (user.subscription.trialEndsAt && user.subscription.trialEndsAt > now);
      hasPlan =
        user.subscription.status === 'active' ||
        isTrialing ||
        (user.subscription.status === 'past_due' &&
          !user.subscription.cancelAtPeriodEnd);
    }
    if (!hasPlan && user.planId !== null && user.planId !== undefined) {
      hasPlan = true;
    }

    await createSession(
      {
        email: data.email as string,
        remember: data.remember as boolean,
      },
      {
        confirmed: user.confirmed ?? false,
        hasPlan,
      },
    );

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
