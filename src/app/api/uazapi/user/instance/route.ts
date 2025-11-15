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

    // Verificar se é uma instância do WhatsApp Cloud (não usa UazAPI)
    const instance = await prisma.instances.findUnique({
      where: { token },
      select: { whatsapp_official_enabled: true },
    });

    console.log('📋 Instância encontrada:', {
      token,
      isWhatsAppCloud: instance?.whatsapp_official_enabled,
    });

    let apiResponse: Response | null = null;
    let apiData: any = null;

    // Se não for instância do WhatsApp Cloud, tentar deletar da API UazAPI
    if (!instance?.whatsapp_official_enabled) {
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
    } else {
      console.log(
        'ℹ️ Instância do WhatsApp Cloud - pulando deleção da API UazAPI',
      );
      // Para instâncias do WhatsApp Cloud, considerar sucesso
      apiResponse = { ok: true } as Response;
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
