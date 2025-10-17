import { z } from 'zod';

const baseSchema = z.object({
  token: z.string().min(1, 'Selecione uma instância'),
  phoneNumber: z.string().min(10, 'Digite um número válido'),
  messageType: z.enum([
    'text',
    'media',
    'contact',
    'location',
    'interactive_menu',
  ]),
  text: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal('')),
  caption: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
});

export const messageConfigSchema = baseSchema.refine(
  (data) => {
    // Validar campos específicos baseado no tipo
    if (data.messageType === 'text') {
      return data.text && data.text.length > 0;
    }
    if (data.messageType === 'media') {
      return data.mediaUrl && data.mediaUrl.length > 0;
    }
    if (data.messageType === 'contact') {
      return data.contactName && data.contactPhone;
    }
    if (data.messageType === 'location') {
      const lat =
        typeof data.latitude === 'string'
          ? data.latitude
          : data.latitude?.toString();
      const lng =
        typeof data.longitude === 'string'
          ? data.longitude
          : data.longitude?.toString();
      return (
        lat &&
        lat.length > 0 &&
        lng &&
        lng.length > 0 &&
        !isNaN(parseFloat(lat)) &&
        !isNaN(parseFloat(lng))
      );
    }
    return true;
  },
  (data) => {
    // Retornar mensagem de erro apropriada
    if (data.messageType === 'text') {
      return { message: 'Digite uma mensagem', path: ['text'] };
    }
    if (data.messageType === 'media') {
      return { message: 'Digite uma URL válida', path: ['mediaUrl'] };
    }
    if (data.messageType === 'contact') {
      return {
        message: 'Preencha o nome e telefone do contato',
        path: ['contactName'],
      };
    }
    if (data.messageType === 'location') {
      return {
        message: 'Digite latitude e longitude válidas',
        path: ['latitude'],
      };
    }
    return { message: 'Erro de validação', path: [] };
  },
);

export type MessageConfigSchema = z.infer<typeof baseSchema>;
