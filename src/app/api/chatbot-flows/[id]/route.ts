import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

// GET - Buscar fluxo específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const flow = await prisma.chatbot_flows.findUnique({
      where: { id: params.id },
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

    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'Fluxo não encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, flow });
  } catch (error) {
    console.error('Error fetching flow:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar fluxo' },
      { status: 500 },
    );
  }
}

// PUT - Atualizar fluxo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const { name, description, nodes, edges, token, isActive } = body;

    const flow = await prisma.chatbot_flows.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(nodes !== undefined && { nodes }),
        ...(edges !== undefined && { edges }),
        ...(token !== undefined && { token }),
        ...(isActive !== undefined && { isActive }),
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

    return NextResponse.json({ success: true, flow });
  } catch (error) {
    console.error('Error updating flow:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar fluxo' },
      { status: 500 },
    );
  }
}

// DELETE - Deletar fluxo (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Soft delete - apenas marca como inativo
    await prisma.chatbot_flows.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Fluxo deletado com sucesso',
    });
  } catch (error) {
    console.error('Error deleting flow:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar fluxo' },
      { status: 500 },
    );
  }
}
