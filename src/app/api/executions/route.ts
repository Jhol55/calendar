import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!flowId) {
      return NextResponse.json(
        { error: 'flowId is required' },
        { status: 400 },
      );
    }

    // Buscar execuções do fluxo
    const executions = await prisma.flow_executions.findMany({
      where: {
        flowId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Contar total de execuções
    const total = await prisma.flow_executions.count({
      where: {
        flowId,
      },
    });

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching executions:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
