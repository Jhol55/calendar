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
  mediaType: z
    .enum(['image', 'video', 'document', 'audio', 'myaudio', 'ptt', 'sticker'])
    .optional(),
  docName: z.string().optional(),
  caption: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactOrganization: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactUrl: z.string().url().optional().or(z.literal('')),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  // Campos do menu interativo
  interactiveMenuType: z
    .enum(['button', 'list', 'poll', 'carousel'])
    .optional(),
  interactiveMenuText: z.string().optional(),
  interactiveMenuFooter: z.string().optional(),
  interactiveMenuListButton: z.string().optional(),
  interactiveMenuImageButton: z.string().optional(),
  interactiveMenuSelectableCount: z.union([z.string(), z.number()]).optional(),
  interactiveMenuChoices: z.string().optional(), // JSON stringified array
  // Opções avançadas para mensagens de texto
  linkPreview: z.boolean().optional(),
  linkPreviewTitle: z.string().optional(),
  linkPreviewDescription: z.string().optional(),
  linkPreviewImage: z.string().optional(),
  linkPreviewLarge: z.boolean().optional(),
  replyId: z.string().optional(),
  mentions: z.string().optional(),
  readChat: z.boolean().optional(),
  readMessages: z.boolean().optional(),
  delay: z.union([z.string(), z.number()]).optional(),
  forward: z.boolean().optional(),
  trackSource: z.string().optional(),
  trackId: z.string().optional(),
});

export const messageConfigSchema = baseSchema.refine(
  (data) => {
    // Validar campos específicos baseado no tipo
    if (data.messageType === 'text') {
      return data.text && data.text.length > 0;
    }
    if (data.messageType === 'media') {
      return data.mediaUrl && data.mediaUrl.length > 0 && data.mediaType;
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
    if (data.messageType === 'interactive_menu') {
      // Validar menu interativo
      if (!data.interactiveMenuType) return false;
      if (!data.interactiveMenuText || data.interactiveMenuText.length === 0)
        return false;

      try {
        const choicesStr = data.interactiveMenuChoices || '';

        // Se for modo JSON (valor dummy ou variável dinâmica), considerar válido
        if (
          choicesStr === '__JSON_MODE__' ||
          /^\{\{.+\}\}$/.test(choicesStr.trim())
        ) {
          // Para lista, ainda precisa validar o botão
          if (
            data.interactiveMenuType === 'list' &&
            !data.interactiveMenuListButton
          ) {
            return false;
          }
          return true;
        }

        const choices = choicesStr ? JSON.parse(choicesStr) : [];
        if (!Array.isArray(choices) || choices.length === 0) return false;

        // Validações específicas por tipo
        if (data.interactiveMenuType === 'button') {
          // Botões: mínimo 1, máximo 3
          if (choices.length < 1 || choices.length > 3) return false;
        }

        if (data.interactiveMenuType === 'list') {
          // Lista: mínimo 1 item + ListButton obrigatório
          if (choices.length < 1) return false;
          if (!data.interactiveMenuListButton) return false;
        }

        if (data.interactiveMenuType === 'poll') {
          // Enquete: mínimo 2 opções
          if (choices.length < 2) return false;
        }

        if (data.interactiveMenuType === 'carousel') {
          // Carrossel: mínimo 1 card
          if (choices.length < 1) return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  },
  (data) => {
    // Retornar mensagem de erro apropriada
    if (data.messageType === 'text') {
      return { message: 'Digite uma mensagem', path: ['text'] };
    }
    if (data.messageType === 'media') {
      if (!data.mediaType) {
        return { message: 'Selecione o tipo de mídia', path: ['mediaType'] };
      }
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
    if (data.messageType === 'interactive_menu') {
      // Mensagens de erro específicas por tipo
      if (!data.interactiveMenuType) {
        return {
          message: 'Selecione o tipo de menu interativo',
          path: ['interactiveMenuType'],
        };
      }

      if (!data.interactiveMenuText || data.interactiveMenuText.length === 0) {
        return {
          message: 'Digite o texto do menu',
          path: ['interactiveMenuText'],
        };
      }

      try {
        const choicesStr = data.interactiveMenuChoices || '';

        // Se for modo JSON (valor dummy ou variável dinâmica), não validar
        if (
          choicesStr === '__JSON_MODE__' ||
          /^\{\{.+\}\}$/.test(choicesStr.trim())
        ) {
          // Validar apenas o botão da lista se for tipo list
          if (
            data.interactiveMenuType === 'list' &&
            !data.interactiveMenuListButton
          ) {
            return {
              message: 'Digite o texto do botão da lista',
              path: ['interactiveMenuListButton'],
            };
          }
          // Para variáveis dinâmicas, não validar mais nada
          return { message: 'Erro de validação', path: [] };
        }

        const choices = choicesStr ? JSON.parse(choicesStr) : [];

        if (data.interactiveMenuType === 'button') {
          if (choices.length === 0) {
            return {
              message: 'Adicione pelo menos 1 botão (máximo 3)',
              path: ['interactiveMenuChoices'],
            };
          }
          if (choices.length > 3) {
            return {
              message: 'Máximo de 3 botões permitidos',
              path: ['interactiveMenuChoices'],
            };
          }
        }

        if (data.interactiveMenuType === 'list') {
          if (choices.length === 0) {
            return {
              message: 'Adicione pelo menos 1 item à lista',
              path: ['interactiveMenuChoices'],
            };
          }
          if (!data.interactiveMenuListButton) {
            return {
              message: 'Digite o texto do botão da lista',
              path: ['interactiveMenuListButton'],
            };
          }
        }

        if (data.interactiveMenuType === 'poll') {
          if (choices.length < 2) {
            return {
              message: 'Adicione pelo menos 2 opções para a enquete',
              path: ['interactiveMenuChoices'],
            };
          }
        }

        if (data.interactiveMenuType === 'carousel') {
          if (choices.length === 0) {
            return {
              message: 'Adicione pelo menos 1 card ao carrossel',
              path: ['interactiveMenuChoices'],
            };
          }
        }
      } catch {
        return {
          message: 'Erro ao processar opções do menu',
          path: ['interactiveMenuChoices'],
        };
      }

      return {
        message: 'Configure o menu interativo corretamente',
        path: ['interactiveMenuType'],
      };
    }
    return { message: 'Erro de validação', path: [] };
  },
);

export type MessageConfigSchema = z.infer<typeof baseSchema>;
