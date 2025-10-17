import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

// GET - Listar todos os fluxos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    const where: { isActive: boolean; userId?: number; token?: string } = {
      isActive: true,
    };

    if (userId) where.userId = parseInt(userId);
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, nodes, edges, token, userId } = body;

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
        userId,
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
