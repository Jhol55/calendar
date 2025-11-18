import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, token } = requestData;

    console.log('🗑️ API Route - Iniciando deleção:', { email, token });

    if (!email || !token) {
      console.error('❌ API Route - Campos obrigatórios faltando');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar dados completos da instância
    const instance = await prisma.instances.findUnique({
      where: { token },
      select: {
        whatsapp_official_enabled: true,
        whatsapp_official_phone_number_id: true,
        whatsapp_official_access_token: true,
        whatsapp_official_business_account_id: true,
        whatsapp_official_phone_number: true,
      },
    });

    const phoneDisplayName = instance?.whatsapp_official_phone_number || '';
    const phoneDisplayNameLower = phoneDisplayName.toLowerCase();
    const isTestAccount =
      phoneDisplayNameLower === 'test number' ||
      phoneDisplayNameLower.includes('public test number');

    console.log('📋 Instância encontrada:', {
      token,
      isWhatsAppCloud: instance?.whatsapp_official_enabled,
      phoneNumberId: instance?.whatsapp_official_phone_number_id,
      phoneDisplayName,
      isTestAccount,
    });

    let apiResponse: Response | null = null;
    let apiData = null;

    // Se for instância do WhatsApp Cloud, desregistrar o número antes de deletar
    // Exceto quando for conta de teste (Meta Test Number / Public Test Number),
    // para não perder o número de teste global.
    if (instance?.whatsapp_official_enabled && !isTestAccount) {
      console.log(
        'ℹ️ Instância do WhatsApp Cloud - desregistrando número antes de deletar...',
      );

      if (
        instance.whatsapp_official_phone_number_id &&
        instance.whatsapp_official_access_token
      ) {
        try {
          console.log(
            `📝 Desregistrando número ${instance.whatsapp_official_phone_number_id}...`,
          );

          const deregisterResponse = await fetch(
            `https://graph.facebook.com/v21.0/${instance.whatsapp_official_phone_number_id}/deregister`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${instance.whatsapp_official_access_token}`,
              },
            },
          );

          if (deregisterResponse.ok) {
            console.log('✅ Número desregistrado com sucesso');
          } else {
            const errorText = await deregisterResponse.text();
            console.warn(
              '⚠️ Não foi possível desregistrar o número:',
              errorText,
            );
            // Continuar mesmo assim - pode já estar desregistrado ou não ser possível
          }
        } catch (deregisterError) {
          console.warn(
            '⚠️ Erro ao desregistrar número (continuando deleção):',
            deregisterError,
          );
          // Continuar para deletar do banco mesmo se o desregistro falhar
        }
      } else {
        console.log(
          '⚠️ Instância Cloud sem phone_number_id ou access_token - pulando desregistro',
        );
      }

      // Para instâncias do WhatsApp Cloud, considerar sucesso
      apiResponse = { ok: true } as Response;
    } else {
      // Se não for instância do WhatsApp Cloud, tentar deletar da API UazAPI
      console.log('🔄 Tentando deletar da API UazAPI...');
      try {
        apiResponse = await fetch(`${process.env.UAZAPI_URL}/instance`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            token: `${token}`,
          },
        });

        apiData = await apiResponse.json();
        console.log('📋 Resposta da API UazAPI:', {
          ok: apiResponse.ok,
          status: apiResponse.status,
          data: apiData,
        });
      } catch (apiError) {
        console.error('❌ Erro ao deletar da API UazAPI:', apiError);
        // Continuar para deletar do banco mesmo se a API falhar
      }
    }

    // Deletar do banco de dados (independente do resultado da API UazAPI)
    try {
      console.log('🗄️ Deletando do banco de dados...');
      await prisma.instances.delete({
        where: { token },
      });
      console.log('✅ Instância deletada do banco de dados com sucesso');
    } catch (dbError) {
      console.error('❌ Erro ao deletar do banco de dados:', dbError);
      return NextResponse.json(
        {
          error: 'Erro ao deletar instância do banco de dados',
          details: String(dbError),
        },
        { status: 500 },
      );
    }

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: 'Instância deletada com sucesso',
      ...(apiData || {}),
    });
  } catch (error) {
    console.error('❌ Erro geral ao deletar instância:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 },
    );
  }
}
