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
): Promise<WhatsAppOfficialResponse> {
  try {
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
    const [stateEmail, timestamp, ...nameParts] = decodedState.split(':');
    const instanceName = nameParts.join(':');

    if (stateEmail !== email) {
      return {
        success: false,
        message: 'Email não corresponde ao state',
        code: 403,
      };
    }

    // Trocar código por access token
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

    // Buscar WhatsApp Business Accounts (WABA)
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/businesses?access_token=${accessToken}`,
    );

    if (!wabaResponse.ok) {
      const errorText = await wabaResponse.text();
      console.error('Erro ao buscar WABAs:', errorText);
      return {
        success: false,
        message: 'Erro ao buscar WhatsApp Business Accounts',
        code: wabaResponse.status,
      };
    }

    const wabaData = await wabaResponse.json();
    const wabas = wabaData.data || [];

    if (wabas.length === 0) {
      return {
        success: false,
        message: 'Nenhuma WhatsApp Business Account encontrada',
        code: 404,
      };
    }

    const wabaId = wabas[0].id;

    // Buscar números de telefone do WABA
    const phoneNumbersResponse = await fetch(
      `https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
    );

    if (!phoneNumbersResponse.ok) {
      const errorText = await phoneNumbersResponse.text();
      console.error('Erro ao buscar phone numbers:', errorText);
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
    const phoneNumberId = phoneNumber.id;
    const phoneNumberValue =
      phoneNumber.verified_name ||
      phoneNumber.display_phone_number ||
      phoneNumber.id;

    // Registrar número para Cloud API (se ainda não estiver registrado)
    // Para coexistência, o número já pode estar em uso pelo WhatsApp Business app
    const registerResponse = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
        }),
      },
    );

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      // Não falhar - pode já estar registrado ou ser número de coexistência
      console.log(
        '⚠️ Registro do número (pode já estar registrado):',
        errorText,
      );
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
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/whatsapp-official`;
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
