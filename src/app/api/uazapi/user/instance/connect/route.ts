import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, token } = requestData;

    if (!email || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${process.env.UAZAPI_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: `${token}`,
      },
    });

    if (response?.ok) {
      // Atualizar status no PostgreSQL
      try {
        await prisma.instances.update({
          where: {
            token: token,
          },
          data: {
            status: 'connecting',
            updated: new Date().toISOString(),
            currentTime: new Date().toISOString(),
          },
        });
      } catch (dbError) {
        console.error('Error updating instance in database:', dbError);
        // Não retornar erro, apenas log
      }

      return NextResponse.json({ message: 'Instance connected' });
    } else {
      return NextResponse.json(
        { message: response.statusText },
        { status: response.status },
      );
    }
  } catch (error) {
    console.error('Error fetching instances:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
