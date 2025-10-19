import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // Buscar execução
    const execution = await prisma.flow_executions.findUnique({
      where: { id },
    });

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 },
      );
    }

    // Só pode parar execuções que estão rodando
    if (execution.status !== 'running') {
      return NextResponse.json(
        {
          error: `Cannot stop execution with status: ${execution.status}`,
          currentStatus: execution.status,
        },
        { status: 400 },
      );
    }

    // Atualizar status para "stopped"
    const stoppedExecution = await prisma.flow_executions.update({
      where: { id },
      data: {
        status: 'stopped',
        endTime: new Date(),
        duration: execution.startTime
          ? Date.now() - new Date(execution.startTime).getTime()
          : undefined,
        error: 'Execution stopped by user',
      },
    });

    console.log(`🛑 Execution ${id} stopped by user`);

    return NextResponse.json(stoppedExecution, { status: 200 });
  } catch (error) {
    console.error('Error stopping execution:', error);
    return NextResponse.json(
      { error: 'Failed to stop execution' },
      { status: 500 },
    );
  }
}
