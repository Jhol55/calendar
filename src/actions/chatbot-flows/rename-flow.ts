'use server';

import { updateFlow } from '@/actions/chatbot-flows/flows';

export async function renameFlow(formData: FormData) {
  const flowId = formData.get('flowId') as string;
  const newName = formData.get('newName') as string;

  if (!flowId) {
    return {
      success: false,
      message: 'ID do fluxo é obrigatório',
      field: 'flowId',
    };
  }

  if (!newName || !newName.trim()) {
    return {
      success: false,
      message: 'Nome do fluxo é obrigatório',
      field: 'newName',
    };
  }

  try {
    const result = await updateFlow(flowId, { name: newName.trim() });

    if (result.success) {
      return {
        success: true,
        message: 'Fluxo renomeado com sucesso',
      };
    }

    return {
      success: false,
      message: result.error || 'Erro ao renomear fluxo',
      field: 'newName',
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro ao renomear fluxo';
    console.error('Error renaming flow:', error);
    return {
      success: false,
      message: errorMessage,
      field: 'newName',
    };
  }
}
