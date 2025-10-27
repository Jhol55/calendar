import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { getSession } from '@/utils/security/session';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

// GET - Listar todos os fluxos do usuário autenticado
// SEGURANÇA: userId é obtido da sessão, não do frontend
export async function GET(request: NextRequest) {
  try {
    // Buscar userId da sessão autenticada
    const session = (await getSession()) as SessionUser | null;

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const where: { isActive: boolean; userId: number; token?: string } = {
      isActive: true,
      userId: user.id, // SEMPRE filtrar pelo usuário autenticado
    };

    if (token) where.token = token;

    const flows = await prisma.chatbot_flows.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            profileName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, flows });
  } catch (error) {
    console.error('Error fetching flows:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar fluxos' },
      { status: 500 },
    );
  }
}

// POST - Criar novo fluxo
// SEGURANÇA: userId é obtido da sessão, não do frontend
export async function POST(request: NextRequest) {
  try {
    // Buscar userId da sessão autenticada
    const session = (await getSession()) as SessionUser | null;

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { name, description, nodes, edges, token } = body;

    if (!name || !nodes || !edges) {
      return NextResponse.json(
        { success: false, error: 'Nome, nodes e edges são obrigatórios' },
        { status: 400 },
      );
    }

    const flow = await prisma.chatbot_flows.create({
      data: {
        name,
        description,
        nodes,
        edges,
        token,
        userId: user.id, // SEMPRE usar o userId da sessão
      },
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            profileName: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, flow }, { status: 201 });
  } catch (error) {
    console.error('Error creating flow:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar fluxo' },
      { status: 500 },
    );
  }
}
