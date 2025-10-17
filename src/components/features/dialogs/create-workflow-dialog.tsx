'use client';

import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { CreateWorkflowForm } from '../forms/chatbot-flow/create-workflow-form';

interface CreateWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (flowName: string) => void;
}

export function CreateWorkflowDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateWorkflowDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} contentClassName="max-w-md">
      <div className="" style={{ zoom: 0.9 }}>
        <div className="my-6">
          <Typography
            variant="h2"
            className="text-2xl font-bold text-center mb-2"
          >
            Criar Novo Workflow
          </Typography>
          <Typography variant="p" className="text-gray-600 text-sm text-center">
            Digite um nome para o seu novo workflow de chatbot.
          </Typography>
        </div>

        <CreateWorkflowForm onSubmit={onSubmit} onCancel={onClose} />
      </div>
    </Dialog>
  );
}
