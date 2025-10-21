'use client';

import React, { useState } from 'react';
import { MoreVertical, Edit2, Trash } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface ColumnActionsProps {
  columnName: string;
  onRename: (columnName: string) => void;
  onDelete: (columnName: string) => void;
}

export function ColumnActions({
  columnName,
  onRename,
  onDelete,
}: ColumnActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRename = () => {
    onRename(columnName);
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete(columnName);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="!p-1 !h-auto hover:bg-neutral-200 rounded transition-colors text-neutral-500"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[180px] py-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleRename}
              className="!w-full !justify-start px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center gap-2 rounded-none"
            >
              <Edit2 className="w-4 h-4 text-neutral-600" />
              <Typography variant="span" className="text-sm">
                Editar coluna
              </Typography>
            </Button>

            <div className="border-t border-neutral-200 my-2" />

            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              className="!w-full !justify-start px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center gap-2 text-red-600 rounded-none"
            >
              <Trash className="w-4 h-4" />
              <Typography variant="span" className="text-sm text-red-600">
                Excluir coluna
              </Typography>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
