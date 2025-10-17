import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Buscar instância no banco PostgreSQL
    const instance = await prisma.instances.findFirst({
      where: { token },
      select: { webhook: true, name: true, profileName: true },
    });

    if (!instance) {
      return NextResponse.json(
        { error: 'Instance not found' },
        { status: 404 },
      );
    }

    console.log('🔍 Instance found:', {
      name: instance.name,
      profileName: instance.profileName,
      webhook: instance.webhook,
    });

    return NextResponse.json({
      token,
      webhook: instance.webhook,
      name: instance.name,
      profileName: instance.profileName,
    });
  } catch (error) {
    console.error('Error fetching instance webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instance webhook' },
      { status: 500 },
    );
  }
}
