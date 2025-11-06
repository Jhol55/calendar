'use client';

import React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FormControl } from '@/components/ui/form-control';
import { SubmitButton } from '@/components/ui/submit-button';
import { ErrorField } from '@/components/ui/error-field';
import { Typography } from '@/components/ui/typography';
import { renameFlowSchema } from './rename-flow.schema';
import { renameFlow } from '@/actions/chatbot-flows/rename-flow';
import { FieldValues, UseFormSetError } from 'react-hook-form';
import { useInvalidateWorkflows } from '@/lib/react-query/hooks/use-workflows';

interface RenameFlowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  flowId: string | null;
  currentName: string;
}

export function RenameFlowDialog({
  isOpen,
  onClose,
  flowId,
  currentName,
}: RenameFlowDialogProps) {
  const { invalidateList } = useInvalidateWorkflows();

  const handleSubmit = async (
    data: FieldValues,
    setError: UseFormSetError<FieldValues>,
  ) => {
    if (!flowId) {
      setError('flowId', {
        message: 'ID do fluxo não encontrado',
      });
      return;
    }

    const formData = new FormData();
    formData.append('flowId', flowId);
    formData.append('newName', data.newName);

    const result = await renameFlow(formData);

    if (!result.success) {
      setError(result.field as 'flowId' | 'newName', {
        message: result.message,
      });
      return;
    }

    // Invalidar cache para atualizar a lista
    invalidateList();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-md"
    >
      <div className="p-6" style={{ zoom: 0.9 }}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Typography variant="h3" className="font-bold text-neutral-800">
              ✏️ Renomear Fluxo
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Digite o novo nome para o fluxo <strong>{currentName}</strong>
            </Typography>
          </div>

          <Form
            zodSchema={renameFlowSchema}
            onSubmit={handleSubmit}
            key={flowId || currentName} // Reset form when flowId or currentName changes
          >
            <div className="flex flex-col gap-4">
              <div>
                <FormControl variant="label" htmlFor="newName">
                  Novo Nome do Fluxo *
                </FormControl>
                <Input
                  id="newName"
                  type="text"
                  fieldName="newName"
                  placeholder="Digite o novo nome"
                  autoFocus
                />
                <ErrorField fieldName="newName" />
              </div>

              <div className="flex gap-3 justify-end">
                <SubmitButton variant="gradient">Renomear</SubmitButton>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </Dialog>
  );
}
