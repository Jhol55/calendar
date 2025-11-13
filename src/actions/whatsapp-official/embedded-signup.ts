'use server';

import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

export interface WhatsAppOfficialResponse {
  success: boolean;
  message?: string;
  code?: number;
  data?: unknown;
}

/**
 * WhatsApp Embedded Signup - Custom Flow: Onboarding Business App Users (Coexistence)
 *
 * Documentação oficial:
 * https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/
 *
 * Este fluxo permite que clientes conectem sua conta existente do WhatsApp Business app
 * usando QR code. O cliente pode usar tanto o WhatsApp Business app quanto a Cloud API
 * simultaneamente no mesmo número.
 */
export async function initiateCloudInstanceCreation(
  name: string,
  currentOrigin?: string,
): Promise<WhatsAppOfficialResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const configId = process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID; // Config ID específico do Embedded Signup
    const baseUrl =
      currentOrigin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/whatsapp-official/create-instance-callback`;

    if (!appId) {
      return {
        success: false,
        message: 'Facebook App ID não configurado',
        code: 500,
      };
    }

    if (!configId) {
      return {
        success: false,
        message: 'WhatsApp Embedded Signup Config ID não configurado',
        code: 500,
      };
    }

    // Criar token temporário para armazenar o nome da instância no state do OAuth
    const tempToken = Buffer.from(`${email}:${Date.now()}:${name}`).toString(
      'base64',
    );

    // OAuth URL para Embedded Signup com featureType de coexistência
    // Para ativar o fluxo de coexistência (Onboarding WhatsApp Business app users),
    // precisamos passar featureType: "whatsapp_business_app_onboarding" nos extras
    // Isso faz o Facebook mostrar a tela de seleção de configuração:
    // 1. Seleção de configuração (conectar existente ou novo número)
    // 2. Inserção de número de telefone (se escolher "Conectar app WhatsApp Business existente")
    // 3. QR code para escanear
    // 4. Seleção de contas WhatsApp Business (se múltiplas após escanear)
    //
    // config_id é obtido do Facebook App Dashboard > WhatsApp > Embedded Signup Builder
    const extras = encodeURIComponent(
      JSON.stringify({
        setup: {},
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3',
      }),
    );

    const oauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code&state=${tempToken}&config_id=${configId}&extras=${extras}&override_default_response_type=true`;

    console.log('🚀 URL OAuth gerada com redirect_uri:', redirectUri);
    console.log('🚀 currentOrigin recebido:', currentOrigin);
    console.log('🚀 baseUrl construído:', baseUrl);

    return {
      success: true,
      message: 'OAuth URL gerada com sucesso',
      data: { oauthUrl, tempToken },
    };
  } catch (error) {
    console.error('Erro ao iniciar criação Cloud:', error);
    return {
      success: false,
      message: 'Erro ao iniciar conexão',
      code: 500,
    };
  }
}

/**
 * Processar callback do OAuth e criar instância Cloud
 *
 * Este callback é chamado após o usuário completar o fluxo de Embedded Signup:
 * 1. Escolheu "Conectar app WhatsApp Business existente"
 * 2. Digitou o número
 * 3. Escaneou o QR code
 * 4. Selecionou contas WhatsApp Business
 * 5. Facebook redireciona para aqui com o código
 */
export async function processOAuthCallback(
  code: string,
  state: string,
  email: string,
  currentOrigin?: string,
  providedWabaId?: string,
  providedPhoneNumberId?: string,
): Promise<WhatsAppOfficialResponse> {
  try {
    // Se email não foi fornecido, obter da sessão
    let userEmail = email;
    if (!userEmail || userEmail === '') {
      const session = (await getSession()) as SessionUser | null;
      userEmail = session?.user?.email || '';

      if (!userEmail) {
        return {
          success: false,
          message: 'Unauthorized: no email in session',
          code: 401,
        };
      }

      console.log('✅ Email obtido da sessão:', userEmail);
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    // Usar domínio atual da requisição se fornecido, caso contrário usar variável de ambiente
    const baseUrl =
      currentOrigin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/whatsapp-official/create-instance-callback`;

    if (!appId || !appSecret) {
      return {
        success: false,
        message: 'Facebook App ID ou Secret não configurado',
        code: 500,
      };
    }

    // Decodificar state para obter nome da instância
    const decodedState = Buffer.from(state, 'base64').toString('utf-8');
    const stateParts = decodedState.split(':');
    const [stateEmail, , ...nameParts] = stateParts;
    const instanceName = nameParts.join(':');

    // Se os IDs foram fornecidos diretamente (via SDK), o state pode ser temporário
    // Nesse caso, aceitar state com "pending" em vez do email
    const isTemporaryState = stateEmail === 'pending';

    if (!isTemporaryState && stateEmail !== userEmail) {
      return {
        success: false,
        message: 'Email não corresponde ao state',
        code: 403,
      };
    }

    console.log('✅ State validado:', {
      isTemporaryState,
      instanceName,
      email: userEmail,
    });

    // Trocar código por access token
    console.log('🔑 Trocando código por token com redirect_uri:', redirectUri);
    console.log('🔑 currentOrigin recebido:', currentOrigin);
    console.log('🔑 baseUrl construído:', baseUrl);

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code: code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar código por token:', errorText);
      return {
        success: false,
        message: 'Erro ao obter access token',
        code: tokenResponse.status,
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('✅ Token obtido com sucesso!');
    console.log('📊 Token data:', JSON.stringify(tokenData, null, 2));

    // Verificar se WABA ID e Phone Number ID foram fornecidos diretamente (Embedded Signup)
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;

    if (providedWabaId && providedPhoneNumberId) {
      console.log('✅ WABA e Phone Number fornecidos na URL do callback!');
      console.log('📱 WABA ID:', providedWabaId);
      console.log('📞 Phone Number ID:', providedPhoneNumberId);
      wabaId = providedWabaId;
      phoneNumberId = providedPhoneNumberId;
    } else if (tokenData.waba_id && tokenData.phone_number_id) {
      console.log('✅ WABA encontrada diretamente no token!');
      console.log('📱 WABA ID:', tokenData.waba_id);
      console.log('📞 Phone Number ID:', tokenData.phone_number_id);
      wabaId = tokenData.waba_id;
      phoneNumberId = tokenData.phone_number_id;
    }

    // Se já temos os IDs, pular a busca de WABAs
    if (wabaId && phoneNumberId) {
      console.log('✅ Pulando busca de WABAs, usando IDs fornecidos...');
      // Continuar direto para configuração
    } else {
      // Buscar WhatsApp Business Accounts (WABA)
      console.log('🔍 Buscando WABAs via API...');

      // Tentar endpoint de businesses
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v23.0/me/businesses?access_token=${accessToken}`,
      );

      if (!wabaResponse.ok) {
        const errorText = await wabaResponse.text();
        console.error('❌ Erro ao buscar WABAs:', errorText);
        return {
          success: false,
          message: 'Erro ao buscar WhatsApp Business Accounts',
          code: wabaResponse.status,
        };
      }

      const wabaData = await wabaResponse.json();
      console.log(
        '📊 Resposta /me/businesses:',
        JSON.stringify(wabaData, null, 2),
      );

      let wabas = wabaData.data || [];

      if (wabas.length === 0) {
        console.log(
          '⚠️ Nenhuma WABA em /me/businesses, tentando endpoint alternativo...',
        );

        // Tentar buscar diretamente via /me (pode conter dados do WhatsApp)
        const meResponse = await fetch(
          `https://graph.facebook.com/v23.0/me?fields=id,name&access_token=${accessToken}`,
        );

        if (meResponse.ok) {
          const meData = await meResponse.json();
          console.log('👤 Dados do /me:', JSON.stringify(meData, null, 2));

          // Tentar buscar WABAs usando o user ID
          if (meData.id) {
            console.log('🔍 Tentando buscar WABAs via user ID...');
            const userWabasResponse = await fetch(
              `https://graph.facebook.com/v23.0/${meData.id}/client_whatsapp_business_accounts?access_token=${accessToken}`,
            );

            if (userWabasResponse.ok) {
              const userWabasData = await userWabasResponse.json();
              console.log(
                '📊 Resposta client_whatsapp_business_accounts:',
                JSON.stringify(userWabasData, null, 2),
              );
              wabas = userWabasData.data || [];
            }
          }
        }

        // Se ainda não encontrou, tentar debug token
        if (wabas.length === 0) {
          console.log('⚠️ Tentando debug token para ver permissões...');

          const debugResponse = await fetch(
            `https://graph.facebook.com/v23.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`,
          );

          if (debugResponse.ok) {
            const debugData = await debugResponse.json();
            console.log('🔍 Debug token:', JSON.stringify(debugData, null, 2));
          }

          return {
            success: false,
            message:
              'Nenhuma WhatsApp Business Account encontrada. Certifique-se de completar o fluxo de Embedded Signup (escanear QR code e selecionar conta).',
            code: 404,
          };
        }

        // Depois de todas as tentativas, usar os dados encontrados
        if (wabas.length > 0) {
          wabaId = wabas[0].id;
          console.log('✅ WABA encontrada via API:', wabaId);
        }
      }
    }

    // Validar que temos WABA ID
    if (!wabaId) {
      return {
        success: false,
        message:
          'Nenhuma WhatsApp Business Account encontrada. Certifique-se de completar o fluxo de Embedded Signup (escanear QR code e selecionar conta).',
        code: 404,
      };
    }

    // Buscar números de telefone do WABA (se ainda não temos)
    let phoneNumberValue: string | null = null;

    if (!phoneNumberId) {
      console.log('🔍 Buscando phone numbers para WABA:', wabaId);

      const phoneNumbersResponse = await fetch(
        `https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
      );

      if (!phoneNumbersResponse.ok) {
        const errorText = await phoneNumbersResponse.text();
        console.error('❌ Erro ao buscar phone numbers:', errorText);
        return {
          success: false,
          message: 'Erro ao buscar números de telefone',
          code: phoneNumbersResponse.status,
        };
      }

      const phoneNumbersData = await phoneNumbersResponse.json();
      const phoneNumbers = phoneNumbersData.data || [];

      if (phoneNumbers.length === 0) {
        return {
          success: false,
          message: 'Nenhum número de telefone encontrado',
          code: 404,
        };
      }

      // Selecionar primeiro número (pode ser múltiplos após o fluxo de coexistência)
      const phoneNumber = phoneNumbers[0];
      phoneNumberId = phoneNumber.id;
      phoneNumberValue =
        phoneNumber.verified_name ||
        phoneNumber.display_phone_number ||
        phoneNumber.id;

      console.log(
        '✅ Phone Number encontrado:',
        phoneNumberId,
        phoneNumberValue,
      );
    } else {
      console.log('✅ Phone Number já fornecido:', phoneNumberId);
      // Buscar detalhes do número
      const phoneNumberResponse = await fetch(
        `https://graph.facebook.com/v23.0/${phoneNumberId}?fields=verified_name,display_phone_number&access_token=${accessToken}`,
      );

      if (phoneNumberResponse.ok) {
        const phoneNumberData = await phoneNumberResponse.json();
        phoneNumberValue =
          phoneNumberData.verified_name ||
          phoneNumberData.display_phone_number ||
          phoneNumberId;
      } else {
        phoneNumberValue = phoneNumberId;
      }
    }

    // Registrar número para Cloud API (OBRIGATÓRIO para enviar mensagens)
    console.log('📝 Registrando número na Cloud API...');

    try {
      const registerPayload: { messaging_product: string; pin?: string } = {
        messaging_product: 'whatsapp',
        // NOTA: PIN de 2FA não está disponível neste fluxo (OAuth callback legado)
        // Para usar PIN (criar ou validar 2FA), use o botão "Conectar WhatsApp Cloud"
        // que usa o SDK do Facebook e permite fornecer o PIN
      };

      const registerResponse = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registerPayload),
        },
      );

      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        console.log(
          '✅ Número registrado com sucesso na Cloud API:',
          registerData,
        );
      } else {
        const errorText = await registerResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const errorCode = errorData.error?.code;
        const errorMessage = errorData.error?.message || errorText;

        // Se o erro for que já está registrado, tudo bem
        if (
          errorCode === 33 ||
          errorText.includes('already') ||
          errorText.includes('registered')
        ) {
          console.log('✅ Número já estava registrado (OK)');
        }
        // Se pedir PIN, avisar que deve usar o fluxo com SDK
        else if (errorCode === 100 && errorText.includes('pin')) {
          console.error(
            '❌ Número requer PIN de 2FA mas este fluxo não suporta PIN',
          );
          throw new Error(
            'Este número tem autenticação de dois fatores (2FA) ativada. ' +
              'Por favor, use o botão "Conectar WhatsApp Cloud" que permite inserir o PIN de 6 dígitos.',
          );
        }
        // Outros erros
        else {
          console.error('❌ Erro ao registrar número:', errorData);
          throw new Error(`Falha ao registrar número: ${errorMessage}`);
        }
      }
    } catch (err) {
      console.error('❌ Exceção ao registrar número:', err);
      throw err; // Re-lançar erro para impedir criação da instância
    }

    // Configurar webhook com campos de coexistência
    // Usar domínio atual se fornecido
    const webhookUrl = `${baseUrl}/api/webhooks/whatsapp-official`;
    const verifyToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

    // Subscrever webhooks incluindo campos de coexistência
    const subscribeResponse = await fetch(
      `https://graph.facebook.com/v23.0/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscribed_fields: [
            'messages',
            'message_status',
            'message_template_status_update',
            // Campos para coexistência (Onboarding WhatsApp Business app users)
            'history', // Histórico de mensagens quando cliente compartilha
            'smb_app_state_sync', // Sincronização de contatos
            'smb_message_echoes', // Mensagens enviadas pelo WhatsApp Business app
          ],
        }),
      },
    );

    if (!subscribeResponse.ok) {
      const errorText = await subscribeResponse.text();
      console.error('Erro ao subscrever webhooks:', errorText);
      // Não falhar completamente, pode ser configurado manualmente depois
    }

    // Gerar token único para a instância
    const instanceToken = `cloud_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const instanceId = instanceToken;

    // Criar instância no banco de dados
    await prisma.instances.create({
      data: {
        id: instanceId,
        token: instanceToken,
        status: 'connected',
        paircode: '',
        qrcode: '',
        name: instanceName,
        webhook: webhookUrl,
        profileName: phoneNumberValue,
        profilePicUrl: '',
        isBusiness: true,
        plataform: 'cloud',
        systemName: 'WhatsApp Cloud API',
        owner: userEmail,
        current_presence: 'available',
        lastDisconnect: '',
        lastDisconnectReason: '',
        adminField01: userEmail,
        adminField02: isTestAccount ? 'whatsapp-cloud-test' : '',
        openai_apikey: '',
        chatbot_enabled: false,
        chatbot_ignoreGroups: false,
        chatbot_stopConversation: '',
        chatbot_stopMinutes: 0,
        chatbot_stopWhenYouSendMsg: 0,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        currentTime: new Date().toISOString(),
        // Campos WhatsApp Official
        whatsapp_official_enabled: true,
        whatsapp_official_access_token: accessToken,
        whatsapp_official_business_account_id: wabaId,
        whatsapp_official_phone_number_id: phoneNumberId,
        whatsapp_official_phone_number: phoneNumberValue,
        whatsapp_official_status: 'connected',
        whatsapp_official_app_id: appId,
        whatsapp_official_webhook_verify_token: verifyToken,
        whatsapp_official_connected_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Instância Cloud criada com sucesso',
      data: {
        instanceToken,
        wabaId,
        phoneNumberId,
        phoneNumber: phoneNumberValue,
      },
    };
  } catch (error) {
    console.error('Erro ao processar callback OAuth:', error);
    return {
      success: false,
      message: 'Erro ao processar conexão',
      code: 500,
    };
  }
}

/**
 * Trocar código do Embedded Signup por token e configurar webhook
 * (Mantido para compatibilidade)
 */
export async function exchangeWhatsAppToken(
  instanceToken: string,
  data: {
    code: string;
    wabaId: string;
    phoneNumberId: string;
  },
): Promise<WhatsAppOfficialResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const instance = await prisma.instances.findUnique({
      where: { token: instanceToken },
    });

    if (!instance || instance.owner !== email) {
      return {
        success: false,
        message: 'Instância não encontrada ou não autorizada',
        code: 404,
      };
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return {
        success: false,
        message: 'Facebook App ID ou Secret não configurado',
        code: 500,
      };
    }

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          code: data.code,
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar código por token:', errorText);
      return {
        success: false,
        message: 'Erro ao obter access token',
        code: tokenResponse.status,
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Buscar informações do número
    const phoneInfoResponse = await fetch(
      `https://graph.facebook.com/v23.0/${data.phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    let phoneNumber = data.phoneNumberId;
    if (phoneInfoResponse.ok) {
      const phoneInfo = await phoneInfoResponse.json();
      phoneNumber =
        phoneInfo.verified_name ||
        phoneInfo.display_phone_number ||
        phoneNumber;
    }

    // Configurar webhook com campos de coexistência
    const verifyToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

    // Subscrever webhooks incluindo coexistência
    const subscribeResponse = await fetch(
      `https://graph.facebook.com/v23.0/${data.wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscribed_fields: [
            'messages',
            'message_status',
            'message_template_status_update',
            'history',
            'smb_app_state_sync',
            'smb_message_echoes',
          ],
        }),
      },
    );

    if (!subscribeResponse.ok) {
      const errorText = await subscribeResponse.text();
      console.error('Erro ao subscrever webhooks:', errorText);
    }

    // Atualizar instância
    await prisma.instances.update({
      where: { token: instanceToken },
      data: {
        whatsapp_official_enabled: true,
        whatsapp_official_access_token: accessToken,
        whatsapp_official_business_account_id: data.wabaId,
        whatsapp_official_phone_number_id: data.phoneNumberId,
        whatsapp_official_phone_number: phoneNumber,
        whatsapp_official_status: 'connected',
        whatsapp_official_app_id: appId,
        whatsapp_official_webhook_verify_token: verifyToken,
        whatsapp_official_connected_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'WhatsApp Official conectado com sucesso',
      data: {
        wabaId: data.wabaId,
        phoneNumberId: data.phoneNumberId,
        phoneNumber,
      },
    };
  } catch (error) {
    console.error('Erro ao trocar token WhatsApp Official:', error);
    return {
      success: false,
      message: 'Erro ao processar conexão',
      code: 500,
    };
  }
}

/**
 * Buscar status da conexão com API oficial do WhatsApp
 */
export async function getWhatsAppOfficialStatus(
  instanceToken: string,
): Promise<WhatsAppOfficialResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const instance = await prisma.instances.findUnique({
      where: { token: instanceToken },
      select: {
        owner: true,
        whatsapp_official_enabled: true,
        whatsapp_official_status: true,
        whatsapp_official_phone_number: true,
        whatsapp_official_phone_number_id: true,
        whatsapp_official_business_account_id: true,
        whatsapp_official_connected_at: true,
      },
    });

    if (!instance || instance.owner !== email) {
      return {
        success: false,
        message: 'Instância não encontrada ou não autorizada',
        code: 404,
      };
    }

    return {
      success: true,
      data: {
        enabled: instance.whatsapp_official_enabled,
        status: instance.whatsapp_official_status || 'disconnected',
        phoneNumber: instance.whatsapp_official_phone_number,
        phoneNumberId: instance.whatsapp_official_phone_number_id,
        businessAccountId: instance.whatsapp_official_business_account_id,
        connectedAt: instance.whatsapp_official_connected_at,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar status WhatsApp Official:', error);
    return {
      success: false,
      message: 'Erro ao buscar status',
      code: 500,
    };
  }
}

/**
 * Desabilitar API oficial do WhatsApp para uma instância
 */
export async function disableWhatsAppOfficial(
  instanceToken: string,
): Promise<WhatsAppOfficialResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const instance = await prisma.instances.findUnique({
      where: { token: instanceToken },
    });

    if (!instance || instance.owner !== email) {
      return {
        success: false,
        message: 'Instância não encontrada ou não autorizada',
        code: 404,
      };
    }

    await prisma.instances.update({
      where: { token: instanceToken },
      data: {
        whatsapp_official_enabled: false,
        whatsapp_official_status: 'disconnected',
      },
    });

    return {
      success: true,
      message: 'API oficial desabilitada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao desabilitar API oficial:', error);
    return {
      success: false,
      message: 'Erro ao desabilitar API oficial',
      code: 500,
    };
  }
}

/**
 * Criar instância Cloud usando WABA ID e Phone Number ID diretamente
 *
 * Esta função é usada quando o Embedded Signup é feito via SDK do Facebook (FB.login)
 * Neste caso, recebemos waba_id, phone_number_id e access_token diretamente
 * via postMessage, sem precisar trocar código por token
 */
export async function createCloudInstanceWithIds(
  name: string,
  wabaId: string,
  phoneNumberId: string,
  accessToken: string | null,
  email: string,
  twoFactorPin?: string,
  isTestAccount = false,
): Promise<WhatsAppOfficialResponse> {
  try {
    console.log('🚀 Criando instância Cloud com IDs diretos');
    console.log('📱 WABA ID:', wabaId);
    console.log('📞 Phone Number ID:', phoneNumberId);
    console.log('📝 Nome:', name);
    console.log('👤 Email:', email);
    console.log(
      '🔑 Access Token:',
      accessToken ? 'fornecido' : 'será configurado depois',
    );
    console.log('🧪 Conta de teste:', isTestAccount ? 'Sim' : 'Não');

    // Buscar detalhes do número de telefone (apenas se temos token)
    let phoneNumberValue = phoneNumberId;
    if (accessToken) {
      try {
        const phoneNumberResponse = await fetch(
          `https://graph.facebook.com/v23.0/${phoneNumberId}?fields=verified_name,display_phone_number&access_token=${accessToken}`,
        );

        if (phoneNumberResponse.ok) {
          const phoneNumberData = await phoneNumberResponse.json();
          phoneNumberValue =
            phoneNumberData.verified_name ||
            phoneNumberData.display_phone_number ||
            phoneNumberId;
          console.log('✅ Nome do número:', phoneNumberValue);
        }
      } catch (err) {
        console.log('⚠️ Não foi possível buscar detalhes do número, usando ID');
      }
    } else {
      console.log('⚠️ Pulando busca de detalhes (sem access token)');
    }

    if (isTestAccount) {
      phoneNumberValue = 'Test Number';
    }

    // Registrar número e configurar webhook apenas se temos token e não for conta de teste
    if (accessToken && !isTestAccount) {
      // Registrar número para Cloud API (OBRIGATÓRIO para enviar mensagens)
      try {
        console.log('📝 Registrando número na Cloud API...');
        console.log(
          '🔑 PIN de 2FA fornecido:',
          twoFactorPin ? 'Sim (6 dígitos)' : 'Não',
        );

        const registerPayload: { messaging_product: string; pin?: string } = {
          messaging_product: 'whatsapp',
        };

        // PIN de 2FA (Importante para segurança):
        // - Se o número JÁ TEM 2FA: deve enviar o PIN existente de 6 dígitos
        // - Se o número NÃO TEM 2FA: o PIN enviado CRIARÁ a proteção 2FA automaticamente
        // - Se não enviar PIN: o número ficará SEM proteção 2FA (vulnerável)
        if (twoFactorPin && twoFactorPin.length === 6) {
          registerPayload.pin = twoFactorPin;
          console.log(
            '✅ PIN será enviado na requisição de registro (habilita/valida 2FA)',
          );
        } else {
          console.log(
            '⚠️ Nenhum PIN fornecido - número ficará sem proteção 2FA (não recomendado)',
          );
        }

        const registerResponse = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerPayload),
          },
        );

        if (registerResponse.ok) {
          const registerData = await registerResponse.json();
          console.log(
            '✅ Número registrado com sucesso na Cloud API:',
            registerData,
          );
        } else {
          const errorText = await registerResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          const errorCode = errorData.error?.code;
          const errorMessage = errorData.error?.message || errorText;

          // Se o erro for que já está registrado, tudo bem
          if (
            errorCode === 33 ||
            errorText.includes('already') ||
            errorText.includes('registered')
          ) {
            console.log('✅ Número já estava registrado (OK)');
          }
          // Se pedir PIN, dar instruções claras
          else if (errorCode === 100 && errorText.includes('pin')) {
            console.error(
              '❌ PIN de 2FA é obrigatório mas não foi fornecido ou está incorreto',
            );

            if (twoFactorPin) {
              // PIN foi fornecido mas está incorreto
              throw new Error(
                'PIN de 2FA incorreto. Verifique o PIN de 6 dígitos configurado no WhatsApp Business Manager e tente novamente.',
              );
            } else {
              // PIN não foi fornecido, mas o número tem 2FA
              throw new Error(
                'Este número tem autenticação de dois fatores (2FA) ativada. ' +
                  'Insira o PIN de 6 dígitos configurado no WhatsApp Business Manager.',
              );
            }
          }
          // Outros erros
          else {
            console.error('❌ Erro ao registrar número:', errorData);
            throw new Error(`Falha ao registrar número: ${errorMessage}`);
          }
        }
      } catch (err) {
        console.error('❌ Exceção ao registrar número:', err);
        throw err; // Re-lançar erro para impedir criação da instância
      }

      // Configurar webhook
      const currentOrigin =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const webhookToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

      if (!webhookToken) {
        console.warn('⚠️ WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado');
      }

      try {
        const subscribeResponse = await fetch(
          `https://graph.facebook.com/v23.0/${wabaId}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (subscribeResponse.ok) {
          console.log('✅ Webhook configurado');
        } else {
          const errorText = await subscribeResponse.text();
          console.log('⚠️ Erro ao configurar webhook:', errorText);
        }
      } catch (err) {
        console.log('⚠️ Erro ao configurar webhook');
      }
    } else {
      if (!accessToken) {
        console.log('⚠️ Pulando registro e webhook (sem access token)');
        console.log(
          'ℹ️  Configure o token permanente depois para ativar a API',
        );
      } else {
        console.log(
          'ℹ️ Conta de teste detectada - pulando registro e exigência de PIN/2FA',
        );
      }
    }

    // Configurar webhook URL
    const currentOrigin =
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${currentOrigin}/api/webhooks/whatsapp-official`;

    // Criar instância no banco
    console.log('💾 Criando instância no banco de dados...');

    // Gerar ID e token únicos
    const instanceId = `cloud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const instanceToken = `${instanceId}_${Math.random().toString(36).substring(2, 15)}`;
    console.log('🆔 ID gerado:', instanceId);
    console.log('🔑 Token gerado:', instanceToken);

    // Gerar valores para campos obrigatórios
    const now = new Date().toISOString();

    const instance = await prisma.instances.create({
      data: {
        id: instanceId,
        token: instanceToken,
        name: name,
        status: 'connected',
        paircode: '',
        qrcode: '',
        webhook: webhookUrl,
        profileName: phoneNumberValue,
        profilePicUrl: '',
        isBusiness: true,
        plataform: 'cloud',
        systemName: 'WhatsApp Cloud API',
        owner: email,
        current_presence: 'available',
        lastDisconnect: '',
        lastDisconnectReason: '',
        adminField01: email,
        adminField02: '',
        openai_apikey: '',
        chatbot_enabled: false,
        chatbot_ignoreGroups: false,
        chatbot_stopConversation: '',
        chatbot_stopMinutes: 0,
        chatbot_stopWhenYouSendMsg: 0,
        created: now,
        updated: now,
        currentTime: now,
        whatsapp_official_enabled: true,
        whatsapp_official_access_token: accessToken,
        whatsapp_official_business_account_id: wabaId,
        whatsapp_official_phone_number_id: phoneNumberId,
        whatsapp_official_phone_number: phoneNumberValue,
        whatsapp_official_status: 'connected',
        whatsapp_official_connected_at: new Date(),
      },
    });

    console.log('✅ Instância criada com sucesso!');
    console.log('📋 Token:', instance.token);

    return {
      success: true,
      message: 'Instância criada com sucesso',
      data: {
        token: instance.token,
        name: instance.name,
        phoneNumber: phoneNumberValue,
      },
    };
  } catch (error) {
    console.error('❌ Erro ao criar instância:', error);
    return {
      success: false,
      message:
        'Erro ao criar instância: ' +
        (error instanceof Error ? error.message : String(error)),
      code: 500,
    };
  }
}
