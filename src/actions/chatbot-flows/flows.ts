'use server';

import { Node, Edge } from 'reactflow';
import { NodeData } from '@/components/layout/chatbot-flow';

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
}

export interface UpdateFlowData {
  name?: string;
  description?: string;
  nodes?: Node<NodeData>[];
  edges?: Edge[];
  token?: string;
  isActive?: boolean;
}

// Listar todos os fluxos
export async function listFlows(filters?: { userId?: number; token?: string }) {
  try {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.token) params.append('token', filters.token);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chatbot-flows?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing flows:', error);
    return { success: false, error: 'Erro ao listar fluxos' };
  }
}

// Buscar fluxo específico
export async function getFlow(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chatbot-flows/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting flow:', error);
    return { success: false, error: 'Erro ao buscar fluxo' };
  }
}

// Criar novo fluxo
export async function createFlow(flowData: CreateFlowData) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chatbot-flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating flow:', error);
    return { success: false, error: 'Erro ao criar fluxo' };
  }
}

// Atualizar fluxo
export async function updateFlow(id: string, flowData: UpdateFlowData) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chatbot-flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating flow:', error);
    return { success: false, error: 'Erro ao atualizar fluxo' };
  }
}

// Deletar fluxo
export async function deleteFlow(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chatbot-flows/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting flow:', error);
    return { success: false, error: 'Erro ao deletar fluxo' };
  }
}
