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
    const nodes = Array.isArray(flow.nodes)
      ? (flow.nodes as Array<{
          id: string;
          type: string;
          data?: {
            webhookConfig?: { webhookId?: string; serviceType?: string };
          };
        }>)
      : [];
    const edges = Array.isArray(flow.edges) ? flow.edges : [];
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
        totalEdges: edges.length,
      },
      nodeAnalysis,
      rawNodes: nodes,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to analyze flow nodes';
    console.error('Error analyzing flow nodes:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
