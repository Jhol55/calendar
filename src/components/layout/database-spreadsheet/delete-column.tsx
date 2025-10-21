'use client';

import React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeleteColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  onConfirm: () => void;
}

export function DeleteColumnDialog({
  isOpen,
  onClose,
  columnName,
  onConfirm,
}: DeleteColumnDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={false}
      contentClassName="max-w-md h-fit"
    >
      <div className="flex flex-col gap-6 p-6" style={{ zoom: 0.9 }}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <Typography
              variant="h3"
              className="text-xl font-bold text-neutral-800"
            >
              Excluir Coluna
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Tem certeza que deseja excluir a coluna{' '}
              <strong className="text-neutral-800">{columnName}</strong>?
            </Typography>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <Typography variant="p" className="text-sm text-red-800">
            <strong>⚠️ Atenção:</strong> Esta ação não pode ser desfeita. Todos
            os dados desta coluna serão permanentemente perdidos.
          </Typography>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            onClick={onClose}
            variant="gradient"
            className="px-4"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            variant="gradient"
            bgHexColor="#ef4444"
            className="px-4"
          >
            Excluir Coluna
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
