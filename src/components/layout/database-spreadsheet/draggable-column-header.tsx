'use client';

import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { ColumnFilter, type FilterCondition } from './column-filter';
import { ColumnActions } from './column-actions';

interface DraggableColumnHeaderProps {
  column: {
    name: string;
    type: string;
    default: unknown;
    required: boolean;
  };
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  dragOverIndex: number | null;
  // Props do ColumnFilter
  onSort: (direction: 'asc' | 'desc') => void;
  onFilter: (value: string) => void;
  onFilterByCondition: (condition: FilterCondition, value?: string) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  uniqueValues: string[];
  // Props do ColumnActions
  onRename: (columnName: string) => void;
  onDelete: (columnName: string) => void;
}

export function DraggableColumnHeader({
  column,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  dragOverIndex,
  onSort,
  onFilter,
  onFilterByCondition,
  onClearFilter,
  hasActiveFilter,
  uniqueValues,
  onRename,
  onDelete,
}: DraggableColumnHeaderProps) {
  const [isHovering, setIsHovering] = useState(false);

  const isSystemColumn =
    column.name === '_id' ||
    column.name === '_createdAt' ||
    column.name === '_updatedAt';

  return (
    <th
      className={`border p-3 text-left border-t-0 ${
        isDragging ? 'opacity-40' : ''
      } ${
        dragOverIndex === index ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
      }`}
      draggable={!isSystemColumn}
      onDragStart={() => !isSystemColumn && onDragStart(index)}
      onDragOver={(e) => !isSystemColumn && onDragOver(e, index)}
      onDrop={() => !isSystemColumn && onDrop(index)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Grip Icon - apenas para colunas não-sistema */}
          {!isSystemColumn && (
            <div
              className={`cursor-grab active:cursor-grabbing transition-opacity ${
                isHovering ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <GripVertical className="w-4 h-4 text-neutral-400" />
            </div>
          )}

          {/* Nome da coluna */}
          <div className="flex flex-col flex-1 min-w-0">
            <Typography
              variant="span"
              className="font-semibold text-neutral-700 truncate"
            >
              {column.name}
            </Typography>
            <Typography
              variant="span"
              className="text-xs text-neutral-500 truncate"
            >
              {column.type}
              {column.required && ' • obrigatório'}
            </Typography>
          </div>
        </div>

        {/* Ações - apenas para colunas não-sistema */}
        {!isSystemColumn && (
          <div className="flex items-center gap-1">
            <ColumnFilter
              columnName={column.name}
              onSort={onSort}
              onFilter={onFilter}
              onFilterByCondition={onFilterByCondition}
              onClearFilter={onClearFilter}
              hasActiveFilter={hasActiveFilter}
              uniqueValues={uniqueValues}
            />

            <ColumnActions
              columnName={column.name}
              onRename={onRename}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </th>
  );
}
