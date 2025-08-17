import { getSession } from '@/utils/security/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

export async function GET() {
  try {
    const session = (await getSession()) as SessionUser | null;

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        email: true,
        confirmed: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // password is intentionally excluded for security
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
