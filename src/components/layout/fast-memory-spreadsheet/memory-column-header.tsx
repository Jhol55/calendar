'use client';

import React from 'react';
import { Typography } from '@/components/ui/typography';
import {
  ColumnFilter,
  type FilterCondition,
} from '../database-spreadsheet/column-filter';

interface MemoryColumnHeaderProps {
  column: {
    name: string;
    type: string;
  };
  // Props do ColumnFilter
  onSort: (direction: 'asc' | 'desc') => void;
  onFilter: (value: string) => void;
  onFilterByCondition: (condition: FilterCondition, value?: string) => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  uniqueValues: string[];
}

export function MemoryColumnHeader({
  column,
  onSort,
  onFilter,
  onFilterByCondition,
  onClearFilter,
  hasActiveFilter,
  uniqueValues,
}: MemoryColumnHeaderProps) {
  const columnDisplayName =
    column.name === 'identificador' || column.name === 'chave'
      ? 'Identificador'
      : column.name === 'valor'
        ? 'Valor'
        : column.name === 'ttlSeconds'
          ? 'TTL (segundos)'
          : 'Expira em';

  const isReadOnly = column.name === 'expiresAt';

  return (
    <th className="border p-3 text-left border-t-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <Typography
            variant="span"
            className="font-semibold text-neutral-700 truncate"
          >
            {columnDisplayName}
          </Typography>
          <Typography
            variant="span"
            className="text-xs text-neutral-500 truncate"
          >
            {column.type}
          </Typography>
        </div>

        {/* Filtros - apenas para colunas não-readonly */}
        {!isReadOnly && (
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
          </div>
        )}
      </div>
    </th>
  );
}
