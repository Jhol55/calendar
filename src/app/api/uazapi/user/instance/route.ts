import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, token } = requestData;

    if (!email || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Excluir da API UazAPI
    const response = await fetch(`${process.env.UAZAPI_URL}/instance`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        token: `${token}`,
      },
    });

    const data = await response.json();

    // Se a exclusão da API foi bem-sucedida, excluir do banco de dados
    if (response.ok) {
      try {
        await prisma.instances.delete({
          where: { token },
        });
      } catch (dbError) {
        console.error('Error deleting instance from database:', dbError);
        // Não falhar a operação se houver erro no banco, pois a API já foi excluída
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting instance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
