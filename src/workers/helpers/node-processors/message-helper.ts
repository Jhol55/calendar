/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessageConfig } from '@/components/layout/chatbot-flow/types';
import type { WebhookJobData } from '@/services/queue';
import { replaceVariables } from '../variable-replacer';
import { prisma } from '../../../services/prisma';
import * as WhatsAppCloudService from '../../../services/whatsapp-cloud/whatsapp-cloud.service';

interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface MemoryConfig {
  action: 'save' | 'fetch' | 'delete';
  memoryName: string;
  items?: Array<{ key: string; value: string }>;
  ttl?: number;
  defaultValue?: string;
  saveMode?: 'overwrite' | 'append';
}

/**
 * Verifica se uma instância é do tipo WhatsApp Cloud API (oficial)
 */
async function isWhatsAppCloudInstance(token: string): Promise<boolean> {
  try {
    const instance = await prisma.instances.findUnique({
      where: { token },
      select: {
        plataform: true,
        whatsapp_official_enabled: true,
      },
    });

    return (
      instance?.plataform === 'cloud' &&
      instance?.whatsapp_official_enabled === true
    );
  } catch (error) {
    console.error('Error checking instance type:', error);
    return false;
  }
}

/**
 * Processa um nó de mensagem (Message Node)
 * Envia mensagens via WhatsApp usando UAZAPI ou WhatsApp Cloud API (oficial)
 *
 * Detecta automaticamente o tipo de instância e roteia para o serviço apropriado:
 * - UAZAPI: para instâncias tradicionais
 * - WhatsApp Cloud API: para instâncias oficiais (plataform: 'cloud')
 *
 * Suporta múltiplos tipos de mensagem:
 * - text: Mensagem de texto simples
 * - media: Imagem, vídeo, áudio, documento
 * - contact: Compartilhar contato
 * - location: Compartilhar localização
 * - interactive_menu: Menus interativos (botões, listas, carousels)
 * - template: Templates aprovados (apenas WhatsApp Cloud API)
 */
export async function processMessageNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
  variableContext: any,
  processNodeMemory?: (
    config: MemoryConfig,
    execId: string,
    context: any,
  ) => Promise<any>,
): Promise<unknown> {
  console.log('📝 Processing message node');
  console.log('📊 Node:', node);

  const messageConfig = node.data?.messageConfig as MessageConfig | undefined;
  if (!messageConfig) {
    throw new Error('Message configuration not found');
  }

  console.log('📋 Message config:', messageConfig);

  const {
    token,
    phoneNumber,
    text,
    messageType,
    mediaUrl,
    mediaType,
    docName,
    caption,
    contactName,
    contactPhone,
    contactOrganization,
    contactEmail,
    contactUrl,
    latitude,
    longitude,
    interactiveMenu,
    // Template (WhatsApp Cloud API)
    templateName,
    templateLanguage,
    templateVariables: rawTemplateVariables,
    // Opções avançadas
    linkPreview,
    linkPreviewTitle,
    linkPreviewDescription,
    linkPreviewImage,
    linkPreviewLarge,
    replyId,
    mentions,
    readChat,
    readMessages,
    delay,
    forward,
    trackSource,
    trackId,
  } = messageConfig;

  if (!token || !phoneNumber) {
    throw new Error('Token and phoneNumber are required');
  }

  try {
    console.log(
      `📤 Sending ${messageType || 'text'} message to ${phoneNumber}`,
    );

    // Verificar se é instância WhatsApp Cloud API
    const isCloudInstance = await isWhatsAppCloudInstance(token);
    console.log(
      `🔍 Instance type: ${isCloudInstance ? 'WhatsApp Cloud API' : 'UAZAPI'}`,
    );

    // Debug: Log do contexto disponível
    console.log('🔍 Variable context available:', {
      hasNodeInput: !!variableContext.$node.input,
      availableNodes: Object.keys(variableContext.$nodes),
      hasLoop: !!variableContext.$loop,
    });

    // Substituir variáveis em todos os campos
    const resolvedPhoneNumber = replaceVariables(phoneNumber, variableContext);
    const resolvedText = text ? replaceVariables(text, variableContext) : text;
    const resolvedMediaUrl = mediaUrl
      ? replaceVariables(mediaUrl, variableContext)
      : mediaUrl;
    const resolvedCaption = caption
      ? replaceVariables(caption, variableContext)
      : caption;
    const resolvedContactName = contactName
      ? replaceVariables(contactName, variableContext)
      : contactName;
    const resolvedContactPhone = contactPhone
      ? replaceVariables(contactPhone, variableContext)
      : contactPhone;
    const resolvedContactOrganization = contactOrganization
      ? replaceVariables(contactOrganization, variableContext)
      : contactOrganization;
    const resolvedContactEmail = contactEmail
      ? replaceVariables(contactEmail, variableContext)
      : contactEmail;
    const resolvedContactUrl = contactUrl
      ? replaceVariables(contactUrl, variableContext)
      : contactUrl;

    // Preparar dados baseado no tipo de mensagem
    const formData: Record<string, any> = {
      number: resolvedPhoneNumber,
    };

    switch (messageType) {
      case 'text':
        if (!resolvedText) throw new Error('Text message content is required');
        formData.text = resolvedText;
        break;

      case 'media':
        if (!resolvedMediaUrl) throw new Error('Media URL is required');
        if (!mediaType) throw new Error('Media type is required');
        formData.type = mediaType;
        formData.file = resolvedMediaUrl;
        if (resolvedCaption) formData.text = resolvedCaption;
        if (docName && mediaType === 'document') {
          formData.docName = replaceVariables(docName, variableContext);
        }
        break;

      case 'contact':
        if (!resolvedContactName || !resolvedContactPhone)
          throw new Error('Contact name and phone are required');
        formData.fullName = resolvedContactName;
        formData.phoneNumber = resolvedContactPhone;
        if (resolvedContactOrganization) {
          formData.organization = resolvedContactOrganization;
        }
        if (resolvedContactEmail) {
          formData.email = resolvedContactEmail;
        }
        if (resolvedContactUrl) {
          formData.url = resolvedContactUrl;
        }
        break;

      case 'location':
        if (!latitude || !longitude)
          throw new Error('Latitude and longitude are required');
        formData.latitude = latitude;
        formData.longitude = longitude;
        break;

      case 'interactive_menu':
        if (!interactiveMenu) {
          throw new Error('Interactive menu configuration is required');
        }

        // Resolver variáveis dinâmicas nos campos do menu
        const resolvedMenuText = replaceVariables(
          interactiveMenu.text,
          variableContext,
        );

        // Resolver choices - verificar se já é um array parseado
        let resolvedMenuChoices: any[];

        // Se choices for um array com 1 item que é uma variável
        if (interactiveMenu.choices.length === 1) {
          const firstChoice = replaceVariables(
            interactiveMenu.choices[0],
            variableContext,
          );

          // Se replaceVariables já retornou um array parseado, usar diretamente
          if (Array.isArray(firstChoice)) {
            console.log(
              '✅ replaceVariables returned parsed array, using directly',
            );
            resolvedMenuChoices = [firstChoice]; // Manter como array com 1 elemento para próxima validação
          } else {
            resolvedMenuChoices = [firstChoice];
          }
        } else {
          // Se choices tiver múltiplos itens, resolver cada um
          resolvedMenuChoices = interactiveMenu.choices.map((choice: string) =>
            replaceVariables(choice, variableContext),
          );
        }

        // Se o primeiro choice for uma variável de carousel (array de objetos ou string JSON), processar
        if (resolvedMenuChoices.length === 1) {
          const firstItem = resolvedMenuChoices[0];

          try {
            let parsedValue: any;

            // Agora replaceVariables sempre retorna string, então só precisa parsear
            if (typeof firstItem === 'string') {
              parsedValue = JSON.parse(firstItem);
            } else {
              throw new Error('Invalid choice format - expected string');
            }

            // Caso 1: Objeto único com 'category' (LIST de uma categoria)
            if (
              !Array.isArray(parsedValue) &&
              typeof parsedValue === 'object' &&
              parsedValue.category
            ) {
              console.log('📋 Detected single LIST category object');
              const listChoices: string[] = [];

              // Adicionar categoria
              if (parsedValue.category && parsedValue.category.trim() !== '') {
                listChoices.push(`[${parsedValue.category}]`);
                console.log(`✅ Added category: [${parsedValue.category}]`);
              }

              // Adicionar items
              if (parsedValue.items && Array.isArray(parsedValue.items)) {
                parsedValue.items.forEach((item: any, itemIndex: number) => {
                  console.log(`📋 Processing item ${itemIndex}:`, item);
                  if (item.text && item.text.trim() !== '') {
                    const choice = `${item.text}|${item.id || ''}|${item.description || ''}`;
                    listChoices.push(choice);
                    console.log(`✅ Added item: ${choice}`);
                  }
                });
              }

              resolvedMenuChoices = listChoices;
              console.log(
                `📋 Final: Converted single LIST category to ${listChoices.length} choices`,
              );
            }
            // Caso 2: Array de objetos
            else if (Array.isArray(parsedValue) && parsedValue.length > 0) {
              // Verificar se é um array de objetos (formato carousel)
              if (typeof parsedValue[0] === 'object' && parsedValue[0].title) {
                // FORMATO CAROUSEL
                const carouselChoices: string[] = [];
                parsedValue.forEach((card) => {
                  // Adicionar título e descrição
                  if (card.title && card.title.trim() !== '') {
                    const titleLine = card.description
                      ? `[${card.title}\n${card.description}]`
                      : `[${card.title}]`;
                    carouselChoices.push(titleLine);
                  }

                  // Adicionar imagem
                  if (card.imageUrl && card.imageUrl.trim() !== '') {
                    carouselChoices.push(`{${card.imageUrl}}`);
                  }

                  // Adicionar botões
                  if (card.buttons && Array.isArray(card.buttons)) {
                    card.buttons.forEach(
                      (button: {
                        text: string;
                        id: string;
                        actionType?: string;
                      }) => {
                        if (button.text && button.text.trim() !== '') {
                          let finalId = button.id || '';
                          if (button.actionType === 'copy') {
                            finalId = `copy:${button.id}`;
                          } else if (button.actionType === 'call') {
                            finalId = `call:${button.id}`;
                          } else if (button.actionType === 'return_id') {
                            finalId = `${button.id}`;
                          }
                          carouselChoices.push(`${button.text}|${finalId}`);
                        }
                      },
                    );
                  }
                });
                resolvedMenuChoices = carouselChoices;
                console.log(
                  `🎠 Converted carousel variable to ${carouselChoices.length} choices`,
                );
              } else if (
                typeof parsedValue[0] === 'object' &&
                parsedValue[0].category
              ) {
                // FORMATO LIST
                console.log('📋 Detected LIST format!');
                console.log(
                  '📋 Parsed value:',
                  JSON.stringify(parsedValue, null, 2),
                );

                const listChoices: string[] = [];
                parsedValue.forEach((categoryObj: any, catIndex: number) => {
                  console.log(
                    `📋 Processing category ${catIndex}:`,
                    categoryObj.category,
                  );
                  console.log(
                    `📋 Category has ${categoryObj.items?.length || 0} items`,
                  );

                  // Adicionar categoria (com [])
                  if (
                    categoryObj.category &&
                    categoryObj.category.trim() !== ''
                  ) {
                    listChoices.push(`[${categoryObj.category}]`);
                    console.log(`✅ Added category: [${categoryObj.category}]`);
                  }

                  // Adicionar items da categoria
                  if (categoryObj.items && Array.isArray(categoryObj.items)) {
                    categoryObj.items.forEach(
                      (item: any, itemIndex: number) => {
                        console.log(`📋 Processing item ${itemIndex}:`, item);
                        if (item.text && item.text.trim() !== '') {
                          const choice = `${item.text}|${item.id || ''}|${item.description || ''}`;
                          listChoices.push(choice);
                          console.log(`✅ Added item: ${choice}`);
                        } else {
                          console.log(
                            `⚠️ Item ${itemIndex} skipped - no text or empty`,
                          );
                        }
                      },
                    );
                  } else {
                    console.log('⚠️ Category has no items array');
                  }
                });
                resolvedMenuChoices = listChoices;
                console.log(
                  `📋 Final: Converted list variable to ${listChoices.length} choices`,
                );
                console.log('📋 Final choices:', listChoices);
              }
            }
          } catch {
            // Se não for JSON válido, manter como está
          }
        }
        const resolvedMenuFooter = interactiveMenu.footerText
          ? replaceVariables(interactiveMenu.footerText, variableContext)
          : undefined;
        const resolvedMenuListButton = interactiveMenu.listButton
          ? replaceVariables(interactiveMenu.listButton, variableContext)
          : undefined;
        const resolvedMenuImageButton = interactiveMenu.imageButton
          ? replaceVariables(interactiveMenu.imageButton, variableContext)
          : undefined;

        // Montar payload conforme documentação UAZAPI
        formData.type = interactiveMenu.type;
        formData.text = resolvedMenuText;
        formData.choices = resolvedMenuChoices; // Array direto, não JSON string

        if (resolvedMenuFooter) {
          formData.footerText = resolvedMenuFooter;
        }
        if (resolvedMenuListButton) {
          formData.listButton = resolvedMenuListButton;
        }
        if (resolvedMenuImageButton) {
          formData.imageButton = resolvedMenuImageButton;
        }
        if (interactiveMenu.selectableCount) {
          formData.selectableCount = interactiveMenu.selectableCount;
        }

        console.log('📋 Interactive menu payload:', {
          type: formData.type,
          text: formData.text,
          choicesCount: resolvedMenuChoices.length,
        });
        break;

      case 'template':
        // Configuração de template é tratada especificamente na lógica de WhatsApp Cloud API.
        // Não exige texto nesta etapa. Apenas garantir que fluxo continue.
        break;

      default:
        // Se não especificar tipo, assume texto
        if (!resolvedText) throw new Error('Text message content is required');
        formData.text = resolvedText;
    }

    // Adicionar opções avançadas ao formData (se fornecidas)
    // Link preview é apenas para mensagens de texto
    if (messageType === 'text') {
      if (linkPreview !== undefined) {
        formData.linkPreview = linkPreview;
      }
      if (linkPreviewTitle) {
        formData.linkPreviewTitle = replaceVariables(
          linkPreviewTitle,
          variableContext,
        );
      }
      if (linkPreviewDescription) {
        formData.linkPreviewDescription = replaceVariables(
          linkPreviewDescription,
          variableContext,
        );
      }
      if (linkPreviewImage) {
        formData.linkPreviewImage = replaceVariables(
          linkPreviewImage,
          variableContext,
        );
      }
      if (linkPreviewLarge !== undefined) {
        formData.linkPreviewLarge = linkPreviewLarge;
      }
    }

    // Opções comuns a todos os tipos de mensagem
    if (replyId) {
      formData.replyid = replaceVariables(replyId, variableContext);
    }
    if (mentions) {
      formData.mentions = replaceVariables(mentions, variableContext);
    }
    if (readChat !== undefined) {
      formData.readchat = readChat;
    }
    if (readMessages !== undefined) {
      formData.readmessages = readMessages;
    }
    if (delay !== undefined) {
      formData.delay = delay;
    }
    if (forward !== undefined) {
      formData.forward = forward;
    }
    if (trackSource) {
      formData.track_source = replaceVariables(trackSource, variableContext);
    }
    if (trackId) {
      formData.track_id = replaceVariables(trackId, variableContext);
    }

    console.log('📦 FormData:', formData);

    let result: any;

    // Rotear para o serviço apropriado baseado no tipo de instância
    if (isCloudInstance) {
      // ✅ WhatsApp Cloud API (Oficial)
      console.log('🌐 Using WhatsApp Cloud API');

      switch (messageType) {
        case 'text':
          result = await WhatsAppCloudService.sendTextMessage(
            token,
            String(resolvedPhoneNumber),
            String(resolvedText || ''),
            {
              previewUrl: linkPreview || false,
            },
          );
          break;

        case 'media':
          if (!resolvedMediaUrl) throw new Error('Media URL is required');
          if (!mediaType) throw new Error('Media type is required');

          // Mapear tipos de mídia específicos para os suportados pela API oficial
          let cloudMediaType: 'image' | 'video' | 'document' | 'audio' =
            'document';
          if (
            mediaType === 'image' ||
            mediaType === 'video' ||
            mediaType === 'audio'
          ) {
            cloudMediaType = mediaType;
          } else if (mediaType === 'document') {
            cloudMediaType = 'document';
          } else if (mediaType === 'myaudio' || mediaType === 'ptt') {
            cloudMediaType = 'audio';
          }

          result = await WhatsAppCloudService.sendMediaMessage(
            token,
            String(resolvedPhoneNumber),
            String(resolvedMediaUrl),
            cloudMediaType,
            {
              caption: resolvedCaption ? String(resolvedCaption) : undefined,
              filename: docName
                ? String(replaceVariables(docName, variableContext))
                : undefined,
            },
          );
          break;

        case 'location':
          if (!latitude || !longitude) {
            throw new Error('Latitude and longitude are required');
          }
          result = await WhatsAppCloudService.sendLocationMessage(
            token,
            String(resolvedPhoneNumber),
            latitude,
            longitude,
          );
          break;

        case 'contact':
          if (!resolvedContactName || !resolvedContactPhone) {
            throw new Error('Contact name and phone are required');
          }

          // Formatar contato para o formato da API oficial
          const cloudContactName = String(resolvedContactName);
          const cloudContactPhone = String(resolvedContactPhone);
          const cloudContacts = [
            {
              name: {
                formatted_name: cloudContactName,
                first_name: cloudContactName.split(' ')[0],
                last_name: cloudContactName.split(' ').slice(1).join(' '),
              },
              phones: cloudContactPhone.split(',').map((phone: string) => ({
                phone: phone.trim(),
                type: 'CELL',
              })),
              emails: resolvedContactEmail
                ? [
                    {
                      email: String(resolvedContactEmail),
                      type: 'WORK',
                    },
                  ]
                : undefined,
              org: resolvedContactOrganization
                ? {
                    company: String(resolvedContactOrganization),
                  }
                : undefined,
              urls: resolvedContactUrl
                ? [
                    {
                      url: String(resolvedContactUrl),
                      type: 'WORK',
                    },
                  ]
                : undefined,
            },
          ];

          result = await WhatsAppCloudService.sendContactMessage(
            token,
            String(resolvedPhoneNumber),
            cloudContacts,
          );
          break;

        case 'interactive_menu':
          if (!interactiveMenu) {
            throw new Error('Interactive menu configuration is required');
          }

          // Resolver variáveis dinâmicas nos campos do menu
          const cloudResolvedMenuText = replaceVariables(
            interactiveMenu.text,
            variableContext,
          );

          // Resolver choices - verificar se já é um array parseado
          let cloudResolvedMenuChoices: any[];

          // Se choices for um array com 1 item que é uma variável
          if (interactiveMenu.choices.length === 1) {
            const firstChoice = replaceVariables(
              interactiveMenu.choices[0],
              variableContext,
            );

            // Se replaceVariables já retornou um array parseado, usar diretamente
            if (Array.isArray(firstChoice)) {
              cloudResolvedMenuChoices = [firstChoice];
            } else {
              cloudResolvedMenuChoices = [firstChoice];
            }
          } else {
            // Se choices tiver múltiplos itens, resolver cada um
            cloudResolvedMenuChoices = interactiveMenu.choices.map(
              (choice: string) => replaceVariables(choice, variableContext),
            );
          }

          // Se o primeiro choice for uma variável (string JSON ou array), processar
          if (cloudResolvedMenuChoices.length === 1) {
            const firstItem = cloudResolvedMenuChoices[0];

            try {
              let parsedValue: any;

              if (typeof firstItem === 'string') {
                parsedValue = JSON.parse(firstItem);
              } else {
                throw new Error('Invalid choice format - expected string');
              }

              // Se for array de objetos com 'category', converter para choices
              if (Array.isArray(parsedValue) && parsedValue.length > 0) {
                if (
                  typeof parsedValue[0] === 'object' &&
                  parsedValue[0].category
                ) {
                  // FORMATO LIST
                  const listChoices: string[] = [];
                  parsedValue.forEach((categoryObj: any) => {
                    // Adicionar categoria
                    if (
                      categoryObj.category &&
                      categoryObj.category.trim() !== ''
                    ) {
                      listChoices.push(`[${categoryObj.category}]`);
                    }

                    // Adicionar items da categoria
                    if (categoryObj.items && Array.isArray(categoryObj.items)) {
                      categoryObj.items.forEach((item: any) => {
                        if (item.text && item.text.trim() !== '') {
                          listChoices.push(
                            `${item.text}|${item.id || ''}|${item.description || ''}`,
                          );
                        }
                      });
                    }
                  });
                  cloudResolvedMenuChoices = listChoices;
                }
              }
            } catch {
              // Se não for JSON válido, manter como está
            }
          }

          const cloudResolvedMenuFooter = interactiveMenu.footerText
            ? replaceVariables(interactiveMenu.footerText, variableContext)
            : undefined;
          const cloudResolvedMenuListButton = interactiveMenu.listButton
            ? replaceVariables(interactiveMenu.listButton, variableContext)
            : undefined;

          // Converter formato UAZAPI para formato WhatsApp Cloud API
          if (interactiveMenu.type === 'button') {
            // Botões: converter choices para botões
            const buttons = cloudResolvedMenuChoices
              .slice(0, 3) // Max 3 botões na API oficial
              .map((choice: string) => {
                const parts = String(choice).split('|');
                return {
                  id: parts[1] || parts[0], // ID ou texto como fallback
                  title: parts[0], // Texto do botão
                };
              });

            result = await WhatsAppCloudService.sendInteractiveButtonMessage(
              token,
              String(resolvedPhoneNumber),
              String(cloudResolvedMenuText),
              buttons,
              {
                footer: cloudResolvedMenuFooter
                  ? String(cloudResolvedMenuFooter)
                  : undefined,
              },
            );
          } else if (interactiveMenu.type === 'list') {
            // Listas: converter choices hierárquicos para sections
            type ListSection = {
              title?: string;
              rows: Array<{
                id: string;
                title: string;
                description?: string;
              }>;
            };

            const sections: ListSection[] = [];
            let currentSection: ListSection | null = null;

            cloudResolvedMenuChoices.forEach((choice: any) => {
              const choiceStr = String(choice);
              // Se começa com [, é uma categoria
              if (choiceStr.startsWith('[') && choiceStr.endsWith(']')) {
                // Salvar seção anterior se existir
                if (currentSection !== null) {
                  sections.push(currentSection);
                }

                // Criar nova seção
                const categoryName = choiceStr.slice(1, -1);
                currentSection = {
                  title: categoryName || undefined,
                  rows: [],
                };
              } else {
                // É um item da categoria
                const parts = choiceStr.split('|');

                // Se não há seção atual, criar uma sem título
                if (currentSection === null) {
                  currentSection = {
                    rows: [],
                  };
                }

                currentSection.rows.push({
                  id: parts[1] || parts[0],
                  title: parts[0],
                  description: parts[2] || undefined,
                });
              }
            });

            // Adicionar última seção
            if (currentSection !== null) {
              const sec = currentSection as ListSection;
              if (sec.rows && sec.rows.length > 0) {
                sections.push(sec);
              }
            }

            // Se não há seções, criar uma padrão
            if (sections.length === 0) {
              sections.push({
                rows: cloudResolvedMenuChoices
                  .slice(0, 10)
                  .map((choice: any) => {
                    const parts = String(choice).split('|');
                    return {
                      id: parts[1] || parts[0],
                      title: parts[0],
                      description: parts[2] || undefined,
                    };
                  }),
              });
            }

            result = await WhatsAppCloudService.sendInteractiveListMessage(
              token,
              String(resolvedPhoneNumber),
              String(cloudResolvedMenuText),
              String(cloudResolvedMenuListButton || 'Ver opções'),
              sections,
              {
                footer: cloudResolvedMenuFooter
                  ? String(cloudResolvedMenuFooter)
                  : undefined,
              },
            );
          } else if (interactiveMenu.type === 'poll') {
            // Poll não é suportado na API oficial
            throw new Error(
              'Poll type is not supported by WhatsApp Cloud API. Please use button or list instead.',
            );
          } else if (interactiveMenu.type === 'carousel') {
            // Carousel não é suportado na API oficial (ainda)
            throw new Error(
              'Carousel type is not yet supported by WhatsApp Cloud API. Please use button or list instead.',
            );
          } else {
            throw new Error(
              `Unknown interactive menu type: ${interactiveMenu.type}`,
            );
          }
          break;

        case 'template':
          // Enviar template via WhatsApp Cloud API
          if (!templateName || !templateLanguage) {
            throw new Error('Template name and language are required');
          }

          // Resolver variáveis do template
          const resolvedTemplateName = replaceVariables(
            templateName,
            variableContext,
          );
          const resolvedTemplateLanguage = replaceVariables(
            templateLanguage,
            variableContext,
          );

          console.log('📄 Sending template:', {
            name: resolvedTemplateName,
            language: resolvedTemplateLanguage,
            hasVariables: !!rawTemplateVariables,
            templateVariablesType: typeof rawTemplateVariables,
            templateVariablesValue: rawTemplateVariables,
          });

          // IMPORTANTE: hello_world NÃO TEM VARIÁVEIS - ignorar qualquer templateVariables
          const normalizedName = resolvedTemplateName?.toLowerCase().trim();
          const isHelloWorld = normalizedName === 'hello_world';

          console.log('🔍 Template check:', {
            resolvedTemplateName,
            normalizedName,
            isHelloWorld,
          });

          // Processar variáveis do template APENAS se fornecidas E não for hello_world
          let components:
            | Array<{
                type: 'header' | 'body' | 'button';
                parameters: Array<{
                  type: 'text';
                  text: string;
                }>;
              }>
            | undefined = undefined;

          if (isHelloWorld) {
            console.log(
              '✅ Template hello_world detectado - FORÇANDO components = undefined',
            );
            components = undefined; // FORÇAR undefined para hello_world
          } else {
            // Verificar se templateVariables tem conteúdo real
            let hasRealVariables = false;
            if (rawTemplateVariables) {
              if (typeof rawTemplateVariables === 'string') {
                const trimmed = rawTemplateVariables.trim();
                hasRealVariables = trimmed !== '' && trimmed !== '{}';
              } else if (typeof rawTemplateVariables === 'object') {
                hasRealVariables = Object.keys(rawTemplateVariables).length > 0;
              }
            }

            console.log('🔍 Has real variables?', hasRealVariables);

            if (hasRealVariables) {
              // templateVariables pode ser um objeto ou JSON string
              let vars: Record<string, string> = {};
              if (typeof rawTemplateVariables === 'string') {
                try {
                  vars = JSON.parse(rawTemplateVariables);
                } catch (err) {
                  console.error('Failed to parse template variables:', err);
                  throw new Error('Invalid template variables format');
                }
              } else {
                vars = rawTemplateVariables;
              }

              // Resolver variáveis e agrupar por componente
              const bodyParams: Array<{ type: 'text'; text: string }> = [];

              Object.entries(vars).forEach(([key, value]) => {
                const resolvedValue = replaceVariables(
                  String(value),
                  variableContext,
                );

                if (key.startsWith('body_')) {
                  bodyParams.push({
                    type: 'text',
                    text: String(resolvedValue),
                  });
                }
              });

              // Adicionar componente BODY se houver parâmetros
              if (bodyParams.length > 0) {
                components = [
                  {
                    type: 'body',
                    parameters: bodyParams,
                  },
                ];

                console.log('✅ Template com parâmetros:', bodyParams.length);
              }
            }
          }

          console.log('📤 Final components antes do envio:', {
            components,
            isUndefined: components === undefined,
            length: components?.length || 0,
          });

          result = await WhatsAppCloudService.sendTemplateMessage(
            token,
            String(resolvedPhoneNumber),
            String(resolvedTemplateName),
            String(resolvedTemplateLanguage),
            components,
          );
          break;

        default:
          // Se não especificar tipo, assume texto
          result = await WhatsAppCloudService.sendTextMessage(
            token,
            String(resolvedPhoneNumber),
            String(resolvedText || ''),
          );
      }

      console.log('✅ Message sent successfully via WhatsApp Cloud API');
    } else {
      // ✅ UAZAPI (Tradicional)
      console.log('🔗 Using UAZAPI');

      // Determinar endpoint baseado no tipo de mensagem
      let endpoint = '/send/text';
      if (messageType === 'interactive_menu') {
        endpoint = '/send/menu';
      } else if (messageType === 'media') {
        endpoint = '/send/media';
      } else if (messageType === 'contact') {
        endpoint = '/send/contact';
      }

      console.log(`🔗 Using endpoint: ${endpoint}`);

      // Chamar API diretamente (sem usar Server Action)
      const response = await fetch(`${process.env.UAZAPI_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: token,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(
          `Failed to send message: ${errorData.error || response.statusText}`,
        );
      }

      result = await response.json();
      console.log('📋 API Response:', result);
    }

    console.log(
      `✅ Message sent successfully to ${resolvedPhoneNumber} from node ${node.id}`,
    );

    // Processar memória se configurada
    let memoryResult = undefined;
    if (messageConfig.memoryConfig && processNodeMemory) {
      const memoryVariableContext = {
        ...variableContext,
        $node: {
          ...variableContext.$node,
          output: {
            apiResponse: result,
            phoneNumber: resolvedPhoneNumber,
            text: resolvedText || text,
            messageType: messageType || 'text',
          },
        },
      };

      console.log('🔍 Memory Variable Context:', {
        apiResponse: result,
        availableKeys: Object.keys(result || {}),
      });

      memoryResult = await processNodeMemory(
        messageConfig.memoryConfig,
        executionId,
        memoryVariableContext,
      );
    }

    return {
      type: 'message',
      status: 'sent',
      phoneNumber: resolvedPhoneNumber,
      text: resolvedText || text,
      messageType: messageType || 'text',
      originalConfig: {
        phoneNumber,
        text,
      },
      resolvedValues: {
        phoneNumber: resolvedPhoneNumber,
        text: resolvedText || text,
      },
      apiResponse: result,
      memoryResult,
    };
  } catch (error) {
    console.error(`❌ Error sending message:`, error);
    throw error;
  }
}
