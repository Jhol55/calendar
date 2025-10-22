'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface RenameTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  onSubmit: (oldName: string, newName: string) => Promise<void>;
}

export function RenameTableDialog({
  isOpen,
  onClose,
  tableName,
  onSubmit,
}: RenameTableDialogProps) {
  const [newName, setNewName] = useState(tableName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewName(tableName);
    }
  }, [isOpen, tableName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      alert('Nome da tabela não pode estar vazio');
      return;
    }

    if (newName === tableName) {
      onClose();
      return;
    }

    // Validar nome
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      alert('Nome de tabela inválido. Use apenas letras, números, _ e -');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(tableName, newName);
      onClose();
    } catch (error) {
      console.error('Error renaming table:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6" style={{ zoom: 0.9 }}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Typography variant="h3" className="font-bold text-neutral-800">
              ✏️ Renomear Tabela
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Digite o novo nome para a tabela <strong>{tableName}</strong>
            </Typography>
          </div>

          <div>
            <label className="block">
              <span className="text-sm font-medium text-neutral-700">
                Novo Nome da Tabela *
              </span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Digite o novo nome"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-md border border-gray-300 bg-neutral-100 p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm"
            />
            <span className="text-xs text-neutral-500 mt-1 block">
              Use apenas letras, números, _ e -
            </span>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="submit" variant="gradient" disabled={isSubmitting}>
              {isSubmitting ? 'Renomeando...' : 'Renomear'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
