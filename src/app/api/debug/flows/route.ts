import { NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET() {
  try {
    const flows = await prisma.chatbot_flows.findMany();

    interface WebhookConfig {
      webhookId?: string;
      serviceType?: string;
    }

    interface FlowNode {
      id?: string;
      type?: string;
      data?: {
        webhookConfig?: WebhookConfig;
      };
    }

    const flowsWithWebhooks = flows.map((flow) => {
      const nodes = Array.isArray(flow.nodes) ? (flow.nodes as FlowNode[]) : [];
      const webhookNodes = nodes.filter((node) => {
        return node.type === 'webhook';
      });

      return {
        id: flow.id,
        name: flow.name,
        totalNodes: nodes.length,
        webhookNodes: webhookNodes.map((node) => {
          return {
            nodeId: node.id,
            webhookConfig: node.data?.webhookConfig,
          };
        }),
      };
    });

    return NextResponse.json({
      totalFlows: flows.length,
      flows: flowsWithWebhooks,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch flows';
    console.error('Debug error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
