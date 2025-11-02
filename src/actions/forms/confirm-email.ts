'use server';

import { generateValidationCodeFromEmail } from '@/utils/security/auth';
import { prisma } from '@/services/prisma';
import { confirmEmailFormSchema } from '@/components/features/forms/confirm-email/confirm-email.schema';
import { updateSessionWithPlanStatus } from '@/utils/security/session';

type ConfirmEmailResponse = {
  success: boolean;
  message?: string;
  code?: number;
  field?: string;
};

export async function confirmEmail(
  formData: FormData,
): Promise<ConfirmEmailResponse> {
  const data = {
    email: formData.get('email'),
    validationCode: formData.get('validationCode'),
  };

  const validationResult = confirmEmailFormSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.errors[0].message,
      code: 400,
      field: validationResult.error.errors[0].path[0] as string,
    };
  }

  const validationCode = await generateValidationCodeFromEmail(
    data.email as string,
  );

  if (data.validationCode !== validationCode) {
    return {
      success: false,
      message: 'Código inválido',
      code: 400,
      field: 'validationCode',
    };
  }

  try {
    const user = await prisma.user.update({
      where: { email: data.email as string },
      data: { confirmed: true },
      select: {
        id: true,
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

    // Atualizar sessão com confirmed: true e hasPlan
    await updateSessionWithPlanStatus(data.email as string, true, hasPlan);

    return {
      success: true,
      message: 'Email confirmado com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Erro ao confirmar email:', error);
    return {
      success: false,
      message: 'Erro ao confirmar email',
      code: 500,
    };
  }
}
