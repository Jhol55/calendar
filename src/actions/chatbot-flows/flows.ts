'use server';

import { Node, Edge } from 'reactflow';
import { NodeData } from '@/components/layout/chatbot-flow';
import { prisma } from '@/services/prisma';
import { getSession } from '@/utils/security/session';

interface SessionUser {
  user: {
    id: number;
    email: string;
  };
}

export interface ChatbotFlow {
  id: string;
  name: string;
  description?: string | null;
  nodes: Node<NodeData>[];
  edges: Edge[];
  token?: string | null;
  userId?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  instance?: {
    id: string;
    name: string;
    profileName: string;
  } | null;
  user?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

export interface CreateFlowData {
  name: string;
  description?: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  token?: string;
  userId?: number;
  isActive?: boolean;
}

export interface UpdateFlowData {
  name?: string;
  description?: string;
  nodes?: Node<NodeData>[];
  edges?: Edge[];
  token?: string;
  isActive?: boolean;
}

export interface FlowFilters {
  userId?: number;
  token?: string;
}

/**
 * Listar todos os fluxos ativos
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function listFlows(filters?: FlowFilters) {
  try {
    // Validação de sessão opcional (se precisar forçar autenticação, descomente)
    // const session = (await getSession()) as SessionUser | null;
    // if (!session) {
    //   return { success: false, error: 'Unauthorized', code: 401 };
    // }

    const where: { isActive: boolean; userId?: number; token?: string } = {
      isActive: true,
    };

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.token) where.token = filters.token;

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

    return { success: true, flows };
  } catch (error) {
    console.error('Error listing flows:', error);
    return { success: false, error: 'Erro ao listar fluxos' };
  }
}

/**
 * Buscar fluxo específico por ID
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function getFlow(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'ID do fluxo é obrigatório' };
    }

    const flow = await prisma.chatbot_flows.findUnique({
      where: { id },
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
      return { success: false, error: 'Fluxo não encontrado' };
    }

    return { success: true, flow };
  } catch (error) {
    console.error('Error getting flow:', error);
    return { success: false, error: 'Erro ao buscar fluxo' };
  }
}

/**
 * Criar novo fluxo
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function createFlow(flowData: CreateFlowData) {
  try {
    const { name, description, nodes, edges, token, userId, isActive } =
      flowData;

    if (!name || !nodes || !edges) {
      return {
        success: false,
        error: 'Nome, nodes e edges são obrigatórios',
      };
    }

    const flow = await prisma.chatbot_flows.create({
      data: {
        name,
        description,
        nodes: nodes as any,
        edges: edges as any,
        token,
        userId,
        isActive: isActive !== undefined ? isActive : true,
      },
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

    return { success: true, flow };
  } catch (error) {
    console.error('Error creating flow:', error);
    return { success: false, error: 'Erro ao criar fluxo' };
  }
}

/**
 * Atualizar fluxo existente
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function updateFlow(id: string, flowData: UpdateFlowData) {
  try {
    if (!id) {
      return { success: false, error: 'ID do fluxo é obrigatório' };
    }

    // Verificar se o fluxo existe
    const existingFlow = await prisma.chatbot_flows.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return { success: false, error: 'Fluxo não encontrado' };
    }

    const { name, description, nodes, edges, token, isActive } = flowData;

    const flow = await prisma.chatbot_flows.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(nodes !== undefined && { nodes: nodes as any }),
        ...(edges !== undefined && { edges: edges as any }),
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { success: true, flow };
  } catch (error) {
    console.error('Error updating flow:', error);
    return { success: false, error: 'Erro ao atualizar fluxo' };
  }
}

/**
 * Deletar fluxo
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function deleteFlow(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'ID do fluxo é obrigatório' };
    }

    // Verificar se o fluxo existe
    const existingFlow = await prisma.chatbot_flows.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return { success: false, error: 'Fluxo não encontrado' };
    }

    await prisma.chatbot_flows.delete({
      where: { id },
    });

    return { success: true, message: 'Fluxo deletado com sucesso' };
  } catch (error) {
    console.error('Error deleting flow:', error);
    return { success: false, error: 'Erro ao deletar fluxo' };
  }
}
