import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const flows = await prisma.chatbot_flows.findMany();

    const flowsWithWebhooks = flows.map((flow) => {
      const nodes = flow.nodes as unknown[];
      const webhookNodes = nodes.filter((node: unknown) => {
        const n = node as { type?: string; data?: { webhookConfig?: any } };
        return n.type === 'webhook';
      });

      return {
        id: flow.id,
        name: flow.name,
        totalNodes: Array.isArray(nodes) ? nodes.length : 0,
        webhookNodes: webhookNodes.map((node: unknown) => {
          const n = node as { id?: string; data?: { webhookConfig?: any } };
          return {
            nodeId: n.id,
            webhookConfig: n.data?.webhookConfig,
          };
        }),
      };
    });

    return NextResponse.json({
      totalFlows: flows.length,
      flows: flowsWithWebhooks,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flows' },
      { status: 500 },
    );
  }
}
