'use client';

import React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface DeleteTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onConfirm: () => void;
}

export function DeleteTableDialog({
  isOpen,
  onClose,
  tableName,
  onConfirm,
}: DeleteTableDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={false}
      contentClassName="max-w-md h-fit"
    >
      <div className="flex flex-col gap-6 p-6" style={{ zoom: 0.9 }}>
        <div className="flex flex-col gap-2">
          <Typography variant="h3" className="font-bold text-neutral-800">
            Excluir Tabela
          </Typography>
          <Typography variant="p" className="text-neutral-600">
            Você tem certeza que deseja excluir a tabela{' '}
            <strong>{tableName}</strong>?
          </Typography>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <Typography variant="p" className="text-red-600 text-sm">
              ⚠️ Esta ação não pode ser desfeita! Todos os dados da tabela serão
              permanentemente perdidos.
            </Typography>
          </div>
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
            onClick={handleConfirm}
            variant="gradient"
            bgHexColor="#ef4444"
            className="px-4"
          >
            Excluir Tabela
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
