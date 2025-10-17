import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flowId');

    if (!flowId) {
      return NextResponse.json(
        { error: 'flowId is required' },
        { status: 400 },
      );
    }

    const flow = await prisma.chatbot_flows.findUnique({
      where: { id: flowId },
      select: {
        id: true,
        name: true,
        nodes: true,
        edges: true,
      },
    });

    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    // Analisar os nodes
    const nodes = flow.nodes as any[];
    const nodeAnalysis = nodes.map((node, index) => ({
      index,
      id: node.id,
      type: node.type,
      dataType: typeof node.data,
      hasWebhookConfig: !!node.data?.webhookConfig,
      webhookId: node.data?.webhookConfig?.webhookId,
      serviceType: node.data?.webhookConfig?.serviceType,
    }));

    return NextResponse.json({
      flow: {
        id: flow.id,
        name: flow.name,
        totalNodes: nodes.length,
        totalEdges: (flow.edges as any[]).length,
      },
      nodeAnalysis,
      rawNodes: nodes,
    });
  } catch (error) {
    console.error('Error analyzing flow nodes:', error);
    return NextResponse.json(
      { error: 'Failed to analyze flow nodes' },
      { status: 500 },
    );
  }
}
