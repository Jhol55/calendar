'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash, MoreHorizontal } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface FlowActionsProps {
  flowId: string;
  flowName: string;
  onRename: (flowId: string, newName: string) => void;
  onDelete: (flowId: string) => void;
}

export function FlowActions({
  flowId,
  flowName,
  onRename,
  onDelete,
}: FlowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(flowId, flowName);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(flowId);
    setIsOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div ref={buttonRef} className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={handleToggle}
          className="!py-1 !px-1 !h-fit rounded transition-colors text-neutral-500 hover:bg-neutral-100"
          title="Opções do fluxo"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {isOpen &&
        createPortal(
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div
              className="fixed z-[9999] bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[180px] py-2"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                zoom: 0.9,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={handleRename}
                className="!w-full !justify-start px-4 py-2 !text-left !text-xs hover:bg-neutral-100 flex items-center gap-2 rounded-none"
              >
                <Edit2 className="w-4 h-4 text-neutral-600" />
                <Typography variant="span" className="text-xs">
                  Renomear fluxo
                </Typography>
              </Button>

              <div className="border-t border-neutral-200 my-2" />

              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                className="!w-full !justify-start px-4 py-2 !text-left !text-xs hover:bg-neutral-100 flex items-center gap-2 text-red-600 rounded-none"
              >
                <Trash className="w-4 h-4" />
                <Typography variant="span" className="text-xs text-red-600">
                  Excluir fluxo
                </Typography>
              </Button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
