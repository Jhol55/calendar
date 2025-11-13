import { z } from 'zod';

const IS_DEV = process.env.NODE_ENV === 'development';

export const createInstanceFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Nome é obrigatório')
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(25, 'Nome deve ter no máximo 25 caracteres')
      .regex(
        /^[a-zA-Z0-9\s\-_]+$/,
        'Nome deve conter apenas letras, números, espaços, hífens e underscores',
      ),
    provider: z.enum(['default', 'cloud'], {
      required_error: 'Selecione um provedor',
    }),
    cloudAccountType: z.enum(['real', 'test']).optional(),
    testAccessToken: z.string().optional(),
    testPhoneNumberId: z.string().optional(),
    testWabaId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!IS_DEV) {
      return;
    }

    if (data.provider === 'cloud') {
      const accountType = data.cloudAccountType;
      if (!accountType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cloudAccountType'],
          message: 'Selecione o tipo de conta (Real ou Teste)',
        });
        return;
      }

      if (accountType === 'test') {
        if (!data.testAccessToken || data.testAccessToken.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['testAccessToken'],
            message: 'Informe o access token da conta de teste',
          });
        }

        if (
          !data.testPhoneNumberId ||
          data.testPhoneNumberId.trim().length === 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['testPhoneNumberId'],
            message: 'Informe o phone_number_id da conta de teste',
          });
        }

        if (!data.testWabaId || data.testWabaId.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['testWabaId'],
            message: 'Informe o WABA ID da conta de teste',
          });
        }
      }
    }
  });
