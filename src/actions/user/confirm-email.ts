'use server';

import { authService } from '@/services/auth';
import { prisma } from '@/lib/prisma';
import { confirmEmailFormSchema } from '@/features/forms/confirm-email/confirm-email.schema';

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

  const validationCode = await authService.generateValidationCodeFromEmail(
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
    await prisma.user.update({
      where: { email: data.email as string },
      data: { confirmed: true },
    });

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
