import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, token } = requestData;

    if (!email || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${process.env.UAZAPI_URL}/instance/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        token: `${token}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (response?.ok && data.instance) {
      // Atualizar as informações no PostgreSQL
      try {
        await prisma.instances.update({
          where: {
            token: token,
          },
          data: {
            status: data.instance.status || 'disconnected',
            paircode: data.instance.paircode || '',
            qrcode: data.instance.qrcode || '',
            profileName: data.instance.profileName || '',
            profilePicUrl: data.instance.profilePicUrl || '',
            isBusiness: data.instance.isBusiness || false,
            plataform: data.instance.plataform || '',
            systemName: data.instance.systemName || '',
            owner: data.instance.owner || '',
            current_presence: data.instance.current_presence || '',
            lastDisconnect: data.instance.lastDisconnect || '',
            lastDisconnectReason: data.instance.lastDisconnectReason || '',
            updated: new Date().toISOString(),
            currentTime: new Date().toISOString(),
          },
        });
      } catch (dbError) {
        console.error('Error updating instance in database:', dbError);
        // Não retornar erro, apenas log
      }

      return NextResponse.json(data);
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
