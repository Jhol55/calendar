import { z } from 'zod';

export const webhookConfigSchema = z
  .object({
    serviceType: z.enum(['manual', 'whatsapp']),
    instanceToken: z.string().optional(),
    webhookId: z.string().optional(),
    methods: z
      .array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']))
      .optional(),
    authenticationType: z.enum(['none', 'basic', 'bearer']).optional(),
    authUsername: z.string().optional(),
    authPassword: z.string().optional(),
    authToken: z.string().optional(),
  })
  .refine(
    (data) => {
      // Se for WhatsApp, deve ter uma instância selecionada
      if (data.serviceType === 'whatsapp') {
        return data.instanceToken && data.instanceToken.length > 0;
      }

      // Se for Manual, deve ter webhookId e métodos
      if (data.serviceType === 'manual') {
        if (!data.webhookId || data.webhookId.length === 0) {
          return false;
        }
        if (!data.methods || data.methods.length === 0) {
          return false;
        }

        // Validar autenticação se não for 'none'
        if (data.authenticationType === 'basic') {
          return (
            data.authUsername &&
            data.authUsername.length > 0 &&
            data.authPassword &&
            data.authPassword.length > 0
          );
        }
        if (data.authenticationType === 'bearer') {
          return data.authToken && data.authToken.length > 0;
        }
      }

      return true;
    },
    (data) => {
      if (data.serviceType === 'whatsapp') {
        return { message: 'Selecione uma instância', path: ['instanceToken'] };
      }

      if (data.serviceType === 'manual') {
        if (!data.webhookId) {
          return {
            message: 'ID do webhook é obrigatório',
            path: ['webhookId'],
          };
        }
        if (!data.methods || data.methods.length === 0) {
          return {
            message: 'Selecione pelo menos um método HTTP',
            path: ['methods'],
          };
        }
        if (data.authenticationType === 'basic') {
          return {
            message: 'Preencha username e password',
            path: ['authUsername'],
          };
        }
        if (data.authenticationType === 'bearer') {
          return { message: 'Digite um token', path: ['authToken'] };
        }
      }

      return { message: 'Erro de validação', path: [] };
    },
  );

export type WebhookConfigSchema = z.infer<typeof webhookConfigSchema>;
