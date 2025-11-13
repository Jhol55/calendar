import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

/**
 * POST /api/whatsapp-templates/create
 * Cria um novo template na WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 Recebendo requisição para criar template:', body);

    const {
      instanceToken,
      name,
      category,
      language,
      bodyText,
      headerText,
      footerText,
      otpButtonText,
      otpType: rawOtpType,
      otpSignatureHash: rawOtpSignatureHash,
    } = body;

    // Validações
    if (!instanceToken || !name || !category || !language || !bodyText) {
      console.error('❌ Campos obrigatórios faltando:', {
        instanceToken: !!instanceToken,
        name: !!name,
        category: !!category,
        language: !!language,
        bodyText: !!bodyText,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            'Campos obrigatórios: instanceToken, name, category, language, bodyText',
        },
        { status: 400 },
      );
    }

    // Buscar informações da instância
    const instance = await prisma.instances.findUnique({
      where: { token: instanceToken },
      select: {
        plataform: true,
        whatsapp_official_enabled: true,
        whatsapp_official_business_account_id: true,
        whatsapp_official_access_token: true,
      },
    });

    if (!instance) {
      console.error('❌ Instance not found:', instanceToken);
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 },
      );
    }

    if (instance.plataform !== 'cloud' || !instance.whatsapp_official_enabled) {
      console.error('❌ Instance is not WhatsApp Cloud API:', {
        plataform: instance.plataform,
        enabled: instance.whatsapp_official_enabled,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Instance is not a WhatsApp Cloud API instance',
        },
        { status: 400 },
      );
    }

    if (
      !instance.whatsapp_official_business_account_id ||
      !instance.whatsapp_official_access_token
    ) {
      console.error('❌ WhatsApp Cloud API credentials not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp Cloud API credentials not configured',
        },
        { status: 400 },
      );
    }

    const wabaId = instance.whatsapp_official_business_account_id;
    const accessToken = instance.whatsapp_official_access_token;

    // Validação: Templates AUTHENTICATION não podem ter HEADER
    if (
      category === 'AUTHENTICATION' &&
      headerText &&
      headerText.trim() !== ''
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Templates de categoria AUTHENTICATION não podem ter cabeçalho (HEADER). Remova o cabeçalho e tente novamente.',
        },
        { status: 400 },
      );
    }

    const otpType = (rawOtpType as string) || 'ZERO_TAP';
    const otpSignatureHash =
      typeof rawOtpSignatureHash === 'string'
        ? rawOtpSignatureHash.trim()
        : undefined;

    // Validação: Templates AUTHENTICATION devem ter botão OTP
    if (
      category === 'AUTHENTICATION' &&
      (!otpButtonText || otpButtonText.trim() === '')
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Templates de categoria AUTHENTICATION devem ter exatamente um botão do tipo OTP. Informe o texto do botão.',
        },
        { status: 400 },
      );
    }

    if (category === 'AUTHENTICATION' && otpType === 'ZERO_TAP') {
      if (!otpSignatureHash || otpSignatureHash.length !== 11) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Para OTP ZERO_TAP é necessário informar o hash de assinatura com exatamente 11 caracteres.',
          },
          { status: 400 },
        );
      }
    }

    // Construir componentes do template
    const components: Array<{
      type: string;
      text?: string;
      format?: string;
      example?: {
        body_text?: string[][];
        header_text?: string[];
      };
      buttons?: Array<{
        type: string;
        text: string;
        otp_type?: string;
        zero_tap_terms_accepted?: boolean;
        supported_apps?: Array<{
          package_name: string;
          signature_hash: string;
        }>;
      }>;
    }> = [];

    // Header (opcional) - Não permitido para AUTHENTICATION
    if (
      headerText &&
      headerText.trim() !== '' &&
      category !== 'AUTHENTICATION'
    ) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText.trim(),
      });
    }

    // Body (obrigatório)
    // Para AUTHENTICATION, o componente BODY NÃO deve ter o campo "text"
    // O texto do corpo é passado diretamente no payload (não no componente)
    if (category === 'AUTHENTICATION') {
      // Para AUTHENTICATION, o componente BODY é apenas um marcador sem campo "text"
      const bodyComponent: {
        type: string;
        example?: {
          body_text: string[][];
        };
      } = {
        type: 'BODY',
      };

      // Extrair variáveis do formato {{1}}, {{2}}, etc. para exemplos
      const bodyVariables: string[] = [];
      const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g);
      if (bodyMatches) {
        bodyMatches.forEach((match: string) => {
          bodyVariables.push(`Example for ${match}`);
        });
        bodyComponent.example = {
          body_text: [bodyVariables],
        };
      }

      components.push(bodyComponent);
    } else {
      // Para UTILITY e MARKETING, usar estrutura normal com campo "text"
      const bodyVariables: string[] = [];
      const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g);
      if (bodyMatches) {
        bodyMatches.forEach((match: string) => {
          bodyVariables.push(`Example for ${match}`);
        });
      }

      const bodyComponent: {
        type: string;
        text: string;
        example?: {
          body_text: string[][];
        };
      } = {
        type: 'BODY',
        text: bodyText.trim(),
      };

      // Se houver variáveis, adicionar exemplos
      if (bodyVariables.length > 0) {
        bodyComponent.example = {
          body_text: [bodyVariables],
        };
      }

      components.push(bodyComponent);
    }

    // Footer (opcional)
    if (footerText && footerText.trim() !== '') {
      components.push({
        type: 'FOOTER',
        text: footerText.trim(),
      });
    }

    // Botão OTP obrigatório para AUTHENTICATION
    if (
      category === 'AUTHENTICATION' &&
      otpButtonText &&
      otpButtonText.trim() !== ''
    ) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'OTP',
            text: otpButtonText.trim(),
            otp_type: otpType,
            ...(otpType === 'ZERO_TAP'
              ? {
                  zero_tap_terms_accepted: true,
                  supported_apps: [
                    {
                      package_name: 'com.whatsapp',
                      signature_hash: otpSignatureHash,
                    },
                  ],
                }
              : {}),
          },
        ],
      });
    }

    console.log('📤 Creating template:', {
      name,
      category,
      language,
      componentsCount: components.length,
    });

    // Construir payload
    // Para AUTHENTICATION, o texto do corpo deve estar no nível raiz do payload
    const payload: {
      name: string;
      category: string;
      language: string;
      components: typeof components;
      body?: string;
    } = {
      name,
      category,
      language,
      components,
    };

    // Para AUTHENTICATION, adicionar body no nível raiz
    if (category === 'AUTHENTICATION') {
      payload.body = bodyText.trim();
    }

    // Criar template via API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      console.error('❌ Error creating template:', errorData);

      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || 'Failed to create template',
          details: errorData,
        },
        { status: response.status },
      );
    }

    const result = await response.json();
    console.log('✅ Template created successfully:', result);

    // Nota: O Meta pode reclassificar automaticamente a categoria do template
    // durante a revisão se detectar que o conteúdo não se encaixa na categoria escolhida.
    // Por exemplo, templates com linguagem promocional podem ser mudados de UTILITY para MARKETING.
    // Isso é normal e será notificado via webhook (template_category_update).

    return NextResponse.json({
      success: true,
      data: result,
      message: `Template created successfully with category "${category}". It will be reviewed within 24-48 hours. Note: Meta may automatically reclassify the category if the content doesn't match the selected category.`,
    });
  } catch (error) {
    console.error('❌ Error creating template (catch):', error);
    console.error(
      'Stack trace:',
      error instanceof Error ? error.stack : 'No stack trace',
    );

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${errorMessage}`,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
