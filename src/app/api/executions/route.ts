import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!flowId) {
      return NextResponse.json(
        { error: 'flowId is required' },
        { status: 400 },
      );
    }

    const executions = await prisma.flow_executions.findMany({
      where: { flowId },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        triggerType: true,
        startTime: true,
        endTime: true,
        duration: true,
        error: true,
        data: true,
        result: true,
        nodeExecutions: true,
      },
    });

    const total = await prisma.flow_executions.count({
      where: { flowId },
    });

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 },
    );
  }
}
