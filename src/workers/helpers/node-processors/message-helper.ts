/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MessageConfig } from '@/components/layout/chatbot-flow/types';
import type { WebhookJobData } from '@/services/queue';
import { replaceVariables } from '../variable-replacer';

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
 * Processa um nó de mensagem (Message Node)
 * Envia mensagens via WhatsApp/Telegram usando UAZAPI
 *
 * Suporta múltiplos tipos de mensagem:
 * - text: Mensagem de texto simples
 * - media: Imagem, vídeo, áudio, documento
 * - contact: Compartilhar contato
 * - location: Compartilhar localização
 * - interactive_menu: Menus interativos (botões, listas, carousels)
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

    const result = await response.json();
    console.log('📋 API Response:', result);
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
