import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

/**
 * Atualiza o node execution com erro quando uma mensagem falha
 * Segue a mesma lógica de erro que já existe no flow-executor.ts
 */
async function updateNodeExecutionWithError(
  phoneNumberId: string,
  messageId: string,
  errors: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: unknown;
    href?: string;
  }>,
) {
  try {
    console.log('🔍 Buscando node execution com message_id:', messageId);

    // Buscar execuções recentes (últimas 24 horas) que podem ter este message_id
    // ✅ Incluir todos os status (running, success, error) para encontrar execuções parciais
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentExecutions = await prisma.flow_executions.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
        // ✅ Remover filtro de status para incluir todas as execuções (incluindo parciais)
        // Isso garante que encontramos execuções parciais mesmo se já terminaram
      },
      select: {
        id: true,
        nodeExecutions: true,
        status: true,
        triggerType: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200, // ✅ Aumentar limite para 200 execuções recentes
    });

    console.log(
      `🔍 Verificando ${recentExecutions.length} execuções recentes (incluindo parciais)...`,
    );
    console.log(
      `🔍 Procurando messageId: ${messageId} em execuções com triggerTypes:`,
      recentExecutions.map((e) => e.triggerType),
    );

    // Procurar o node execution que tem este message_id
    for (const execution of recentExecutions) {
      console.log(
        `🔍 Verificando execução ${execution.id} (status: ${execution.status}, trigger: ${execution.triggerType})`,
      );
      const nodeExecutions =
        (execution.nodeExecutions as Record<
          string,
          {
            result?: any; // ✅ Usar any para permitir estrutura flexível
            status?: string;
          }
        >) || {};

      for (const [nodeId, nodeExecution] of Object.entries(nodeExecutions)) {
        const result = nodeExecution.result;

        // ✅ Buscar messageId de forma mais robusta (seguindo a mesma lógica do message-helper.ts)
        // No message-helper.ts, o messageId é extraído assim:
        // result?.messages?.[0]?.id || result?.message_id || result?.id || null
        // E depois salvo diretamente em result.messageId
        let foundMessageId: string | null = null;

        if (result && typeof result === 'object') {
          // 1. Tentar encontrar messageId diretamente (como salvo no message-helper.ts)
          if ('messageId' in result && result.messageId === messageId) {
            foundMessageId = result.messageId as string;
            console.log(
              `🔍 [${nodeId}] messageId encontrado diretamente: ${foundMessageId}`,
            );
          }
          // 2. Tentar encontrar em apiResponse (estrutura do WhatsApp Cloud)
          // Seguindo a mesma lógica de extração do message-helper.ts
          else if (
            'apiResponse' in result &&
            result.apiResponse &&
            typeof result.apiResponse === 'object'
          ) {
            const apiResponse = result.apiResponse as any;
            // Mesma lógica do message-helper.ts linha 1045-1049
            const extractedMessageId =
              apiResponse.messages?.[0]?.id ||
              apiResponse.message_id ||
              apiResponse.id ||
              null;

            if (extractedMessageId === messageId) {
              foundMessageId = extractedMessageId;
              console.log(
                `🔍 [${nodeId}] messageId encontrado em apiResponse: ${foundMessageId}`,
              );
            } else if (extractedMessageId) {
              console.log(
                `🔍 [${nodeId}] messageId diferente encontrado em apiResponse: ${extractedMessageId} (procurando: ${messageId})`,
              );
            }
          } else {
            console.log(
              `🔍 [${nodeId}] result não tem messageId nem apiResponse`,
            );
          }
        }

        if (foundMessageId === messageId) {
          console.log(
            `✅ Encontrado node execution: ${nodeId} na execução ${execution.id} (status: ${execution.status}, trigger: ${execution.triggerType})`,
          );

          // Seguir a mesma lógica de erro do flow-executor.ts (linhas 413-423)
          const errorMessage =
            errors[0]?.message || errors[0]?.title || 'Message failed';

          // ✅ Preservar o resultado original e adicionar informações de erro
          // Garantir que messageId está presente (pode estar em result.messageId ou result.apiResponse)
          const originalMessageId =
            (result as any)?.messageId ||
            (result as any)?.apiResponse?.messages?.[0]?.id ||
            (result as any)?.apiResponse?.message_id ||
            (result as any)?.apiResponse?.id ||
            foundMessageId;

          // ✅ Criar resultado de erro seguindo a mesma estrutura do flow-executor.ts
          // Mas preservando informações úteis do resultado original (apiResponse, messageId, etc)
          const errorResult = {
            // Preservar campos úteis do resultado original
            type: (result as any)?.type || 'message',
            phoneNumber: (result as any)?.phoneNumber,
            text: (result as any)?.text,
            messageType: (result as any)?.messageType,
            messageId: originalMessageId, // ✅ Garantir que messageId está presente
            apiResponse: (result as any)?.apiResponse, // Preservar resposta da API original

            // ✅ Campos de erro (sobrescrevem qualquer campo anterior)
            success: false,
            error: true,
            status: 'failed', // ✅ Mudar status de 'sent' para 'failed'
            message: errorMessage,
            errors: errors,
            errorCode: errors[0]?.code,
            errorTitle: errors[0]?.title,
          };

          const updatedNodeExecution = {
            ...nodeExecution,
            status: 'error',
            endTime: new Date().toISOString(),
            error: errorMessage,
            result: errorResult,
          };

          nodeExecutions[nodeId] = updatedNodeExecution;

          // Atualizar no banco
          await prisma.flow_executions.update({
            where: { id: execution.id },
            data: {
              nodeExecutions: nodeExecutions as any,
            },
          });

          console.log(
            `✅ Node execution ${nodeId} atualizado com erro na execução ${execution.id}`,
          );
          console.log('📊 Resultado de erro salvo:', {
            success: errorResult.success,
            error: errorResult.error,
            status: errorResult.status,
            message: errorResult.message,
            errorCode: errorResult.errorCode,
            errorTitle: errorResult.errorTitle,
            messageId: errorResult.messageId,
          });
          return; // Encontrou e atualizou, pode parar
        }
      }
    }

    console.log(
      `⚠️ Node execution não encontrado para message_id: ${messageId}`,
    );
    console.log(
      `💡 Dica: Verifique se o messageId está sendo salvo corretamente no resultado do message-node`,
    );
  } catch (error) {
    console.error('❌ Erro ao atualizar node execution:', error);
    throw error;
  }
}

/**
 * Webhook do WhatsApp Official (Meta/Facebook)
 *
 * URL estática: /api/webhooks/whatsapp-official
 *
 * O Facebook envia requisições GET para verificar o webhook quando você configura
 * e requisições POST para enviar eventos (mensagens, status, etc)
 *
 * Identificamos a instância através do phone_number_id que vem no payload
 */
export async function GET(request: NextRequest) {
  try {
    // Log completo para debug
    console.log('🔍 GET webhook verification request recebido');
    console.log('📡 URL completa:', request.url);
    console.log(
      '📋 Query params:',
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('📋 Parâmetros extraídos:', {
      mode,
      token: token ? `${token.substring(0, 10)}...` : null,
      challenge: challenge ? `${challenge.substring(0, 10)}...` : null,
    });

    // Verificação de webhook (Facebook envia GET com esses parâmetros)
    if (mode === 'subscribe' && token) {
      // Verificar se o token corresponde ao configurado
      const verifyToken =
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

      console.log('🔐 Comparando tokens:', {
        recebido: token.substring(0, 10) + '...',
        esperado: verifyToken.substring(0, 10) + '...',
        comprimento_recebido: token.length,
        comprimento_esperado: verifyToken.length,
        match: token === verifyToken,
      });

      if (token === verifyToken) {
        console.log(
          '✅ Webhook verificado com sucesso! Retornando challenge...',
        );
        // Retornar o challenge como texto plano (não JSON)
        return new NextResponse(challenge, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      } else {
        console.error('❌ Token de verificação inválido');
        console.error('Token recebido completo:', token);
        console.error('Token esperado completo:', verifyToken);
        console.error('São iguais?', token === verifyToken);
        return NextResponse.json(
          { error: 'Invalid verify token' },
          { status: 403 },
        );
      }
    }

    console.error('❌ Requisição inválida:', {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge,
    });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('❌ Erro ao verificar webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Receber eventos do WhatsApp Official
 *
 * O payload vem no formato:
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "id": "<WABA_ID>",
 *     "changes": [{
 *       "value": {
 *         "messaging_product": "whatsapp",
 *         "metadata": {
 *           "phone_number_id": "<PHONE_NUMBER_ID>",
 *           ...
 *         },
 *         "messages": [...],
 *         "statuses": [...]
 *       }
 *     }]
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(
      '📥 WhatsApp Official webhook recebido:',
      JSON.stringify(body, null, 2),
    );

    // Verificar estrutura do webhook
    if (!body.entry || !Array.isArray(body.entry) || body.entry.length === 0) {
      console.error('❌ Estrutura de webhook inválida');
      return NextResponse.json(
        { error: 'Invalid webhook structure' },
        { status: 400 },
      );
    }

    // Processar cada entrada
    for (const entry of body.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) {
        continue;
      }

      for (const change of entry.changes) {
        const value = change.value;

        if (!value) {
          continue;
        }

        // Processar evento de atualização de categoria de template
        if (change.field === 'template_category_update') {
          const templateId = value.message_template_id;
          const templateName = value.message_template_name;
          const templateLanguage = value.message_template_language;
          const newCategory = value.new_category;
          const oldCategory = value.old_category;

          console.log('📋 Template category updated:', {
            templateId,
            templateName,
            templateLanguage,
            oldCategory: oldCategory || 'N/A',
            newCategory,
            wabaId: entry.id,
          });

          // Buscar instância pelo WABA ID
          const instance = await prisma.instances.findFirst({
            where: {
              whatsapp_official_business_account_id: entry.id,
              whatsapp_official_enabled: true,
            },
          });

          if (instance) {
            console.log('✅ Instância encontrada para template update:', {
              instanceToken: instance.token,
              instanceName: instance.name,
              templateName,
              categoryChanged: `${oldCategory || 'N/A'} → ${newCategory}`,
            });

            // Salvar recategorização no banco de dados
            try {
              // Verificar se já existe uma recategorização recente para este template
              const existingUpdate =
                await prisma.template_category_updates.findFirst({
                  where: {
                    template_id: templateId.toString(),
                    instance_token: instance.token,
                    template_name: templateName,
                  },
                  orderBy: {
                    updated_at: 'desc',
                  },
                });

              // Se não existe ou se a categoria mudou novamente, criar novo registro
              if (
                !existingUpdate ||
                existingUpdate.new_category !== newCategory
              ) {
                await prisma.template_category_updates.create({
                  data: {
                    template_id: templateId.toString(),
                    template_name: templateName,
                    instance_token: instance.token,
                    old_category: oldCategory || null,
                    new_category: newCategory,
                    language: templateLanguage,
                    waba_id: entry.id,
                    reviewed: false,
                    appealed: false,
                  },
                });

                console.log('✅ Recategorização salva no banco de dados:', {
                  templateId,
                  templateName,
                  oldCategory: oldCategory || 'N/A',
                  newCategory,
                });
              } else {
                console.log(
                  'ℹ️ Recategorização já existe para este template:',
                  {
                    templateId,
                    templateName,
                  },
                );
              }
            } catch (error) {
              console.error('❌ Erro ao salvar recategorização:', error);
              // Não interromper o processamento do webhook se houver erro ao salvar
            }
          } else {
            console.warn('⚠️ Instância não encontrada para WABA ID:', entry.id);
          }

          // Continuar para o próximo evento
          continue;
        }

        // Para outros eventos, verificar se tem metadata
        if (!value.metadata) {
          continue;
        }

        // Extrair phone_number_id do payload
        const phoneNumberId = value.metadata.phone_number_id;

        if (!phoneNumberId) {
          console.error('❌ phone_number_id não encontrado no payload');
          continue;
        }

        // Buscar instância pelo phone_number_id
        const instance = await prisma.instances.findFirst({
          where: {
            whatsapp_official_phone_number_id: phoneNumberId,
            whatsapp_official_enabled: true,
          },
        });

        if (!instance) {
          console.error(
            '❌ Instância não encontrada para phone_number_id:',
            phoneNumberId,
          );
          continue;
        }

        console.log('✅ Instância encontrada:', {
          instanceToken: instance.token,
          instanceName: instance.name,
          phoneNumberId,
        });

        // Processar campo 'messages' - mensagens recebidas
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            console.log('📨 Mensagem recebida:', {
              from: message.from,
              id: message.id,
              type: message.type,
              timestamp: message.timestamp,
            });

            // TODO: Processar mensagem e executar fluxos de chatbot
            // Você pode usar a lógica similar à que existe em /api/webhooks/[userId]/[webhookId]/route.ts
          }
        }

        // Processar campo 'statuses' - status de mensagens
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            console.log('📊 Status de mensagem:', {
              id: status.id,
              status: status.status,
              timestamp: status.timestamp,
            });

            // Se a mensagem falhou, atualizar o node execution correspondente
            if (status.status === 'failed' && status.errors) {
              console.error('❌ Mensagem falhou:', {
                messageId: status.id,
                errors: status.errors,
                recipientId: status.recipient_id,
              });

              // Buscar e atualizar o node execution que tem este message_id
              try {
                await updateNodeExecutionWithError(
                  phoneNumberId,
                  status.id,
                  status.errors,
                );
              } catch (updateError) {
                console.error(
                  '❌ Erro ao atualizar node execution com erro:',
                  updateError,
                );
              }
            }
          }
        }

        // Processar campo 'history' - histórico de mensagens (coexistência)
        // Quando cliente conecta conta existente e compartilha histórico
        if (change.field === 'history' && value.history) {
          console.log('📚 Histórico de mensagens recebido (coexistência):', {
            phoneNumberId,
            historyLength: Array.isArray(value.history)
              ? value.history.length
              : 'N/A',
          });

          if (Array.isArray(value.history)) {
            for (const historyItem of value.history) {
              if (historyItem.messages) {
                console.log(
                  `  📨 ${historyItem.messages.length} mensagens no histórico`,
                );
                // Processar mensagens do histórico para sincronizar
              }
              if (historyItem.errors) {
                console.log(
                  '  ⚠️ Erro ao sincronizar histórico:',
                  historyItem.errors,
                );
                // Cliente pode ter recusado compartilhar histórico
              }
            }
          }
        }

        // Processar campo 'smb_app_state_sync' - sincronização de contatos (coexistência)
        if (change.field === 'smb_app_state_sync' && value.state_sync) {
          console.log('👥 Sincronização de contatos (coexistência):', {
            phoneNumberId,
            contactsCount: Array.isArray(value.state_sync)
              ? value.state_sync.length
              : 0,
          });

          if (Array.isArray(value.state_sync)) {
            for (const syncItem of value.state_sync) {
              console.log('  📇 Contato:', {
                type: syncItem.type,
                action: syncItem.action, // 'add' ou 'remove'
                contact: syncItem.contact,
              });
              // Processar sincronização de contatos
            }
          }
        }

        // Processar campo 'smb_message_echoes' - mensagens enviadas pelo WhatsApp Business app (coexistência)
        if (change.field === 'smb_message_echoes' && value.message_echoes) {
          console.log(
            '📤 Mensagens enviadas pelo WhatsApp Business app (coexistência):',
            {
              phoneNumberId,
              messagesCount: Array.isArray(value.message_echoes)
                ? value.message_echoes.length
                : 0,
            },
          );

          if (Array.isArray(value.message_echoes)) {
            for (const echo of value.message_echoes) {
              console.log('  📨 Echo de mensagem:', {
                from: echo.from,
                to: echo.to,
                id: echo.id,
                type: echo.type,
                timestamp: echo.timestamp,
              });
              // Processar echo de mensagem (mensagem enviada pelo app, não pela API)
            }
          }
        }
      }
    }

    // Sempre retornar 200 OK para o Facebook
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar webhook WhatsApp Official:', error);
    // Retornar 200 mesmo em caso de erro para não bloquear o Facebook
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
