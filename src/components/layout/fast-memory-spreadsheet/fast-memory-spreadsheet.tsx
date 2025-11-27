'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import { EditArrayDialog } from '../database-spreadsheet/edit-array';
import { EditObjectDialog } from '../database-spreadsheet/edit-object';
import { type FilterCondition } from '../database-spreadsheet/column-filter';
import { MemoryColumnHeader } from './memory-column-header';
import { KeyValueSpreadsheet } from './key-value-spreadsheet';
import {
  getMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  type MemoryData,
  type MemoryListResponse,
} from '@/actions/memory/operations';
import { cn } from '@/lib/utils';

interface FastMemorySpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Schema fixo com colunas: identificador, valor, TTL, expiresAt
const FIXED_SCHEMA = {
  columns: [
    { name: 'identificador', type: 'string', default: '', required: true },
    { name: 'valor', type: 'object', default: {}, required: false },
    { name: 'ttlSeconds', type: 'number', default: null, required: false },
    { name: 'expiresAt', type: 'date', default: null, required: false },
  ],
};

// Mapear nome da coluna na interface para nome do campo no banco
function getFieldName(columnName: string): keyof MemoryData {
  if (columnName === 'identificador') {
    return 'chave';
  }
  return columnName as keyof MemoryData;
}

export function FastMemorySpreadsheet({
  isOpen,
  onClose,
}: FastMemorySpreadsheetProps) {
  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreBefore, setLoadingMoreBefore] = useState(false);
  const [lastPageLoaded, setLastPageLoaded] = useState(false);
  const lastPageDataRef = useRef<MemoryData[] | null>(null);
  const [pagination, setPagination] = useState<{
    offset: number;
    startOffset: number;
    totalCount: number;
    hasMore: boolean;
    hasMoreBefore: boolean;
  }>({
    offset: 0,
    startOffset: 0,
    totalCount: 0,
    hasMore: false,
    hasMoreBefore: false,
  });
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    column: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<
    { index: number; id: string }[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    updates: Array<{
      rowId: string;
      column: string;
      value: unknown;
    }>;
    additions: Array<{
      chave: string;
      valor: unknown;
      ttlSeconds?: number | null;
    }>;
    deletions: Array<string>;
  }>({
    updates: [],
    additions: [],
    deletions: [],
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );
  const [columnConditions, setColumnConditions] = useState<
    Record<string, { condition: FilterCondition; value?: string }>
  >({});
  const [sortConfig, setSortConfig] = useState<{
    column: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [direction, setDirection] = useState<'up' | 'down' | undefined>(
    undefined,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showEditArrayDialog, setShowEditArrayDialog] = useState(false);
  const [editingArrayData, setEditingArrayData] = useState<{
    rowId: string;
    column: string;
    array: unknown[];
  } | null>(null);
  const [showEditObjectDialog, setShowEditObjectDialog] = useState(false);
  const [editingObjectData, setEditingObjectData] = useState<{
    rowId: string;
    column: string;
    object: Record<string, unknown>;
  } | null>(null);
  const [showKeyValueSpreadsheet, setShowKeyValueSpreadsheet] = useState(false);
  const [editingValueData, setEditingValueData] = useState<{
    rowId: string;
    column: string;
    object: Record<string, unknown> | Array<Record<string, unknown>>;
    isArray?: boolean;
  } | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Carregar memórias quando abrir ou quando searchQuery mudar
  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery]);

  // Limpar estados quando fechar o dialog
  useEffect(() => {
    if (!isOpen) {
      setMemoryData([]);
      setSelectedRows([]);
      setEditingCell(null);
      setEditingValue('');
      setHasUnsavedChanges(false);
      setLastPageLoaded(false);
      lastPageDataRef.current = null;
      setPagination({
        offset: 0,
        startOffset: 0,
        totalCount: 0,
        hasMore: false,
        hasMoreBefore: false,
      });
      setPendingChanges({
        updates: [],
        additions: [],
        deletions: [],
      });
      setSearchQuery('');
      setSortConfig(null);
      setColumnFilters({});
      setColumnConditions({});
    }
  }, [isOpen]);

  // Handler de teclado para deletar linhas selecionadas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedRows.length > 0 && !editingCell) {
        e.preventDefault();
        handleDeleteSelectedRows();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedRows, editingCell]);

  const loadMemories = async (append = false, customOffset?: number) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        if (customOffset === undefined) {
          setMemoryData([]);
          setPagination({
            offset: 0,
            startOffset: 0,
            totalCount: 0,
            hasMore: false,
            hasMoreBefore: false,
          });
        }
      }

      const currentOffset =
        customOffset !== undefined
          ? customOffset
          : append
            ? pagination.offset
            : 0;

      const response = await getMemories({
        offset: currentOffset,
        limit: 100,
        search: searchQuery || undefined,
      });

      if (response.success && response.data) {
        const listResponse = response.data as MemoryListResponse;

        if (append) {
          setMemoryData((prev) => [...prev, ...listResponse.data]);
        } else {
          setMemoryData(listResponse.data);
        }

        const newOffset = currentOffset + listResponse.data.length;
        setPagination({
          offset: newOffset,
          startOffset: append ? pagination.startOffset : currentOffset,
          totalCount: listResponse.totalCount,
          hasMore: listResponse.hasMore,
          hasMoreBefore: currentOffset > 0,
        });

        // Carregar última página em background após carregamento inicial
        if (!append && listResponse.totalCount > 100) {
          loadLastPageInBackground();
        } else if (!append && listResponse.totalCount <= 100) {
          setLastPageLoaded(true);
          if (currentOffset === 0 && listResponse.totalCount <= 100) {
            lastPageDataRef.current = listResponse.data;
          }
        }
      }
    } catch (error) {
      console.error('Error loading memories:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Carregar última página em background
  const loadLastPageInBackground = async () => {
    try {
      const currentTotal = pagination.totalCount || 0;
      const lastPageOffset = Math.max(0, currentTotal - 100);

      const response = await getMemories({
        offset: lastPageOffset,
        limit: 100,
        search: searchQuery || undefined,
      });

      if (response.success && response.data) {
        const listResponse = response.data as MemoryListResponse;
        lastPageDataRef.current = listResponse.data;
        setLastPageLoaded(true);
      }
    } catch (error) {
      console.error('Error loading last page in background:', error);
    }
  };

  // Carregar última página
  const loadLastPage = async () => {
    try {
      setLoadingMore(true);

      const currentTotal = pagination.totalCount || 0;
      const lastPageOffset = Math.max(0, currentTotal - 100);

      const response = await getMemories({
        offset: lastPageOffset,
        limit: 100,
        search: searchQuery || undefined,
      });

      if (response.success && response.data) {
        const listResponse = response.data as MemoryListResponse;
        const loadedDataLength = listResponse.data.length;

        setMemoryData(listResponse.data);
        setPagination({
          offset: lastPageOffset + loadedDataLength,
          startOffset: lastPageOffset,
          totalCount: listResponse.totalCount,
          hasMore: false,
          hasMoreBefore: lastPageOffset > 0,
        });

        setLastPageLoaded(true);
      }
    } catch (error) {
      console.error('Error loading last page:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Carregar página anterior
  const loadPreviousPage = async () => {
    if (
      pagination.startOffset <= 0 ||
      loadingMoreBefore ||
      loadingMore ||
      loading
    )
      return;

    const previousPageOffset = Math.max(0, pagination.startOffset - 100);

    if (
      previousPageOffset >= pagination.startOffset &&
      previousPageOffset < pagination.offset
    ) {
      setPagination((prev) => ({
        ...prev,
        startOffset: previousPageOffset,
        hasMoreBefore: previousPageOffset > 0,
      }));
      return;
    }

    try {
      setLoadingMoreBefore(true);

      const response = await getMemories({
        offset: previousPageOffset,
        limit: 100,
        search: searchQuery || undefined,
      });

      if (response.success && response.data) {
        const listResponse = response.data as MemoryListResponse;
        const container = tableContainerRef.current;
        const previousScrollHeight = container?.scrollHeight || 0;
        const previousScrollTop = container?.scrollTop || 0;

        setMemoryData((prev) => {
          const newData = listResponse.data;
          const existingIds = new Set(prev.map((row) => row.id));
          const uniqueNewData = newData.filter(
            (row) => !existingIds.has(row.id),
          );
          return [...uniqueNewData, ...prev];
        });

        setPagination((prev) => ({
          ...prev,
          startOffset: previousPageOffset,
          hasMoreBefore: previousPageOffset > 0,
        }));

        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + heightDifference;
          }
          setLoadingMoreBefore(false);
        }, 100);
      } else {
        setLoadingMoreBefore(false);
      }
    } catch (error) {
      console.error('Error loading previous page:', error);
      setLoadingMoreBefore(false);
    }
  };

  // Handler para scroll infinito
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    const threshold = 200;

    // Carregar mais quando estiver a 200px do final
    if (
      scrollHeight - scrollTop - clientHeight < threshold &&
      pagination.hasMore &&
      !loadingMore &&
      !loading
    ) {
      loadMemories(true);
    }

    // Carregar página anterior quando estiver a 200px do topo
    if (
      scrollTop < threshold &&
      pagination.hasMoreBefore &&
      pagination.startOffset > 0 &&
      !loadingMoreBefore &&
      !loadingMore &&
      !loading
    ) {
      loadPreviousPage();
    }
  };

  const handleAddRow = async () => {
    const newRow: MemoryData & { id: string } = {
      id: 'new-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      chave: '',
      valor: {},
      ttlSeconds: null as number | null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const currentTotal = pagination.totalCount || 0;
    const lastPageOffset = Math.max(0, currentTotal - 100);
    const currentPageEnd = pagination.offset;
    const isOnLastPage = pagination.offset >= lastPageOffset;
    const isAtEndOfData = currentPageEnd >= currentTotal;

    if (lastPageLoaded && lastPageDataRef.current) {
      setMemoryData([...lastPageDataRef.current, newRow]);
      setPagination({
        offset: lastPageOffset + lastPageDataRef.current.length + 1,
        startOffset: lastPageOffset,
        totalCount: currentTotal + 1,
        hasMore: false,
        hasMoreBefore: lastPageOffset > 0,
      });
      lastPageDataRef.current = [...lastPageDataRef.current, newRow];
    } else if (isOnLastPage && isAtEndOfData) {
      setMemoryData((prev) => [...prev, newRow]);
      setPagination((prev) => ({
        ...prev,
        totalCount: (prev.totalCount || 0) + 1,
        offset: prev.offset + 1,
      }));
    } else {
      await loadLastPage();
      setMemoryData((prev) => [...prev, newRow]);
      setPagination((prev) => ({
        ...prev,
        totalCount: (prev.totalCount || 0) + 1,
        offset: prev.offset + 1,
      }));
    }

    setPendingChanges((prev) => ({
      ...prev,
      additions: [
        ...prev.additions,
        {
          chave: newRow.chave,
          valor: newRow.valor,
          ttlSeconds: newRow.ttlSeconds,
        },
      ],
    }));

    setHasUnsavedChanges(true);

    setHighlightedRowId(newRow.id);
    setTimeout(() => setHighlightedRowId(null), 3000);

    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100);
  };

  const handleDeleteSelectedRows = () => {
    if (selectedRows.length === 0) return;

    const selectedIds = selectedRows.map((row) => row.id);

    // Remover do estado local
    setMemoryData((prev) =>
      prev.filter((row) => !selectedIds.includes(row.id)),
    );

    // Adicionar às mudanças pendentes (apenas IDs que não são adições pendentes)
    setPendingChanges((prev) => {
      const newDeletions = selectedIds.filter(
        (id) => !id.toString().startsWith('new-'),
      );

      // Remover adições pendentes que foram deletadas
      // As adições não têm ID diretamente, então precisamos manter todas
      // já que não há como associar uma adição a um ID específico
      const newAdditions = prev.additions;

      return {
        ...prev,
        additions: newAdditions,
        deletions: [...prev.deletions, ...newDeletions],
      };
    });

    setSelectedRows([]);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!hasUnsavedChanges) return;

    try {
      setLoading(true);

      // Processar deleções
      for (const id of pendingChanges.deletions) {
        if (!id.toString().startsWith('new-')) {
          await deleteMemory(id);
        }
      }

      // Processar adições
      for (const addition of pendingChanges.additions) {
        // Encontrar a linha correspondente para obter valores atualizados
        const row = memoryData.find(
          (r) =>
            r.id.toString().startsWith('new-') && r.chave === addition.chave,
        );

        if (row || addition.chave) {
          await createMemory(
            row?.chave || addition.chave,
            row?.valor || addition.valor,
            row?.ttlSeconds !== undefined
              ? row.ttlSeconds || undefined
              : addition.ttlSeconds || undefined,
          );
        }
      }

      // Processar atualizações
      for (const update of pendingChanges.updates) {
        if (!update.rowId.toString().startsWith('new-')) {
          const row = memoryData.find((r) => r.id === update.rowId);
          if (row) {
            const updates: {
              chave?: string;
              valor?: unknown;
              ttlSeconds?: number | null;
            } = {};
            // Mapear nome da coluna para nome do campo no banco
            const fieldName = getFieldName(update.column);
            if (fieldName === 'chave') {
              updates.chave =
                typeof update.value === 'string'
                  ? update.value
                  : String(update.value ?? '');
            } else if (fieldName === 'valor') {
              updates.valor = update.value;
            } else if (fieldName === 'ttlSeconds') {
              const numValue =
                typeof update.value === 'number'
                  ? update.value
                  : update.value === null
                    ? null
                    : Number(update.value);
              updates.ttlSeconds =
                isNaN(numValue as number) && numValue !== null
                  ? null
                  : numValue;
            }

            await updateMemory(update.rowId, updates);
          }
        }
      }

      setPendingChanges({
        updates: [],
        additions: [],
        deletions: [],
      });
      setHasUnsavedChanges(false);

      setPagination({
        offset: 0,
        startOffset: 0,
        totalCount: 0,
        hasMore: false,
        hasMoreBefore: false,
      });
      await loadMemories();
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setShowCloseWarning(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseWarning(false);
    setHasUnsavedChanges(false);
    setPendingChanges({
      updates: [],
      additions: [],
      deletions: [],
    });
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseWarning(false);
  };

  // Handlers para filtros e ordenação
  const handleSort = (column: string, sortDirection: 'asc' | 'desc') => {
    setSortConfig({ column, direction: sortDirection });
  };

  const handleFilter = (column: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }));
  };

  const handleClearFilter = (column: string) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
    setColumnConditions((prev) => {
      const newConditions = { ...prev };
      delete newConditions[column];
      return newConditions;
    });
    if (sortConfig?.column === column) {
      setSortConfig(null);
    }
  };

  const handleFilterByCondition = (
    column: string,
    condition: FilterCondition,
    value?: string,
  ) => {
    setColumnConditions((prev) => ({
      ...prev,
      [column]: { condition, value },
    }));
  };

  // Obter valores únicos de uma coluna
  const getUniqueValues = (columnName: string) => {
    return Array.from(
      new Set(
        memoryData.map((row) => {
          const fieldName = getFieldName(columnName);
          const value = row[fieldName];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        }),
      ),
    );
  };

  // Dados filtrados e ordenados
  const filteredAndSortedData = React.useMemo(() => {
    let data = [...memoryData];

    // Aplicar filtros por valor
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      data = data.filter((row) => {
        const fieldName = getFieldName(column);
        const cellValue = row[fieldName];
        const stringValue =
          cellValue === null || cellValue === undefined
            ? ''
            : typeof cellValue === 'object'
              ? JSON.stringify(cellValue)
              : String(cellValue);
        return stringValue.toLowerCase().includes(filterValue.toLowerCase());
      });
    });

    // Aplicar filtros por condição
    Object.entries(columnConditions).forEach(
      ([column, { condition, value }]) => {
        data = data.filter((row) => {
          const fieldName = getFieldName(column);
          const cellValue = row[fieldName];
          const stringValue =
            cellValue === null || cellValue === undefined
              ? ''
              : typeof cellValue === 'object'
                ? JSON.stringify(cellValue)
                : String(cellValue);
          const lowerValue = stringValue.toLowerCase();

          switch (condition) {
            case 'isEmpty':
              return lowerValue === '';
            case 'isNotEmpty':
              return lowerValue !== '';
            case 'contains':
              return value ? lowerValue.includes(value.toLowerCase()) : true;
            case 'notContains':
              return value ? !lowerValue.includes(value.toLowerCase()) : true;
            case 'startsWith':
              return value ? lowerValue.startsWith(value.toLowerCase()) : true;
            case 'endsWith':
              return value ? lowerValue.endsWith(value.toLowerCase()) : true;
            case 'equals':
              return value ? lowerValue === value.toLowerCase() : true;
            default:
              return true;
          }
        });
      },
    );

    // Aplicar ordenação
    if (sortConfig) {
      data.sort((a, b) => {
        const fieldName = getFieldName(sortConfig.column);
        const aValue = a[fieldName];
        const bValue = b[fieldName];
        const aString =
          aValue === null || aValue === undefined
            ? ''
            : typeof aValue === 'object'
              ? JSON.stringify(aValue)
              : String(aValue);
        const bString =
          bValue === null || bValue === undefined
            ? ''
            : typeof bValue === 'object'
              ? JSON.stringify(bValue)
              : String(bValue);

        if (sortConfig.direction === 'asc') {
          return aString.localeCompare(bString);
        } else {
          return bString.localeCompare(aString);
        }
      });
    }

    return data;
  }, [memoryData, columnFilters, columnConditions, sortConfig]);

  // Handler para editar célula (similar ao database-spreadsheet)
  const handleEditCell = (
    rowId: string,
    column: string,
    currentValue: unknown,
  ) => {
    if (column === 'expiresAt') return; // Não editável

    const columnSchema = FIXED_SCHEMA.columns.find(
      (col) => col.name === column,
    );
    const isObjectColumn =
      columnSchema?.type === 'object' || column === 'valor';

    // Primeiro, tentar fazer parse se for string JSON
    let parsedValue = currentValue;

    // Se for string, tentar fazer parse
    if (typeof currentValue === 'string' && currentValue.trim()) {
      try {
        parsedValue = JSON.parse(currentValue);
      } catch {
        // Se não conseguir fazer parse, manter o valor original
        parsedValue = currentValue;
      }
    }

    // Se for coluna de valor, SEMPRE abrir KeyValueSpreadsheet (para objetos OU arrays)
    if (column === 'valor' && isObjectColumn) {
      // Se for array, converter para objeto onde cada elemento vira uma propriedade indexada
      // ou se cada elemento for um objeto com "chave" e "valor", mapear diretamente
      let valueToEdit: unknown = parsedValue;

      // Se for array, precisamos tratar de forma especial
      if (Array.isArray(parsedValue)) {
        // Se o array contém objetos com propriedades "chave" e "valor", usamos como está
        // Caso contrário, convertemos para um formato que o spreadsheet possa processar
        if (
          parsedValue.length > 0 &&
          typeof parsedValue[0] === 'object' &&
          parsedValue[0] !== null
        ) {
          // Array de objetos - o KeyValueSpreadsheet vai tratar como array
          valueToEdit = parsedValue;
        } else {
          // Array de valores primitivos - converter para objeto indexado
          valueToEdit = parsedValue.reduce(
            (acc, item, index) => {
              acc[String(index)] = item;
              return acc;
            },
            {} as Record<string, unknown>,
          );
        }
      } else if (
        typeof parsedValue === 'object' &&
        parsedValue !== null &&
        !Array.isArray(parsedValue)
      ) {
        // É um objeto, usar diretamente
        valueToEdit = parsedValue;
      } else if (parsedValue === null || parsedValue === undefined) {
        // Se for null/undefined, criar objeto vazio
        valueToEdit = {};
      } else {
        // Valores primitivos, criar objeto vazio
        valueToEdit = {};
      }

      // Garantir que é uma cópia para evitar problemas de referência
      const valueCopy = Array.isArray(valueToEdit)
        ? JSON.parse(JSON.stringify(valueToEdit))
        : { ...(valueToEdit as Record<string, unknown>) };

      setEditingValueData({
        rowId,
        column,
        object: valueCopy as Record<string, unknown>,
        isArray: Array.isArray(parsedValue),
      });
      setShowKeyValueSpreadsheet(true);
      return;
    }

    // Verificar se é array para outras colunas (não "valor")
    if (Array.isArray(parsedValue)) {
      // Garantir que é uma cópia do array para evitar problemas de referência
      const arrayCopy = [...parsedValue];
      setEditingArrayData({
        rowId,
        column,
        array: arrayCopy,
      });
      setShowEditArrayDialog(true);
      return;
    }

    // Verificar se é object (para outras colunas de objeto, se houver)
    if (
      (typeof parsedValue === 'object' &&
        parsedValue !== null &&
        !Array.isArray(parsedValue)) ||
      (isObjectColumn && parsedValue === null) ||
      (isObjectColumn && parsedValue === undefined)
    ) {
      let objectValue: Record<string, unknown> = {};

      if (
        typeof parsedValue === 'object' &&
        parsedValue !== null &&
        !Array.isArray(parsedValue)
      ) {
        objectValue = parsedValue as Record<string, unknown>;
      } else {
        // Se for null/undefined e for coluna de objeto, criar objeto vazio
        objectValue = {};
      }

      // Garantir que é uma cópia do objeto para evitar problemas de referência
      const objectCopy = { ...objectValue };
      setEditingObjectData({
        rowId,
        column,
        object: objectCopy,
      });
      setShowEditObjectDialog(true);
      return;
    }

    // Se não for array nem object, abrir edição normal
    setEditingCell({
      rowId,
      column,
    });
    setEditingValue(String(currentValue || ''));
    setValidationError(null);
  };

  // Handler para atualizar célula (similar ao database-spreadsheet)
  const handleUpdateCell = (
    rowId: string,
    column: string,
    value: string,
    originalValue: string,
  ) => {
    // Verificar se o valor realmente mudou
    if (value === originalValue) {
      setEditingCell(null);
      return;
    }

    let newValue: unknown = value;

    // Converter valor baseado no tipo da coluna
    if (column === 'ttlSeconds') {
      newValue =
        value === '' || value === null || value === undefined
          ? null
          : Number(value);
    }

    // Atualizar estado local - mapear nome da coluna para nome do campo
    const fieldName = getFieldName(column);
    setMemoryData((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [fieldName]: newValue,
              updatedAt: new Date(),
            }
          : row,
      ),
    );

    // Adicionar às mudanças pendentes
    setPendingChanges((prev) => {
      // Verificar se a linha está nas adições pendentes
      // Se for uma nova linha (começa com 'new-'), procurar a primeira adição disponível
      const additionIndex = rowId.toString().startsWith('new-') ? 0 : -1;

      if (additionIndex >= 0 && rowId.toString().startsWith('new-')) {
        // Se for uma linha nova, atualizar diretamente no objeto de adição
        const newAdditions = [...prev.additions];
        const row = memoryData.find((r) => r.id === rowId);
        if (row) {
          newAdditions[additionIndex] = {
            chave: row.chave,
            valor: row.valor,
            ttlSeconds: row.ttlSeconds,
          };
        }
        return { ...prev, additions: newAdditions };
      } else {
        // Se for uma linha existente, adicionar às atualizações
        const existingIndex = prev.updates.findIndex(
          (u) => u.rowId === rowId && u.column === column,
        );

        if (existingIndex >= 0) {
          // Atualizar mudança existente
          const newUpdates = [...prev.updates];
          newUpdates[existingIndex] = { rowId, column, value: newValue };
          return { ...prev, updates: newUpdates };
        } else {
          // Adicionar nova mudança
          return {
            ...prev,
            updates: [...prev.updates, { rowId, column, value: newValue }],
          };
        }
      }
    });

    setHasUnsavedChanges(true);
    setEditingCell(null);
    setValidationError(null);
  };

  // Handler para seleção de linhas (seguindo exatamente o padrão do database-spreadsheet)
  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    index: number,
    id: string,
  ) => {
    setSelectedRows((prevSelectedRows) => {
      if (
        e.ctrlKey &&
        prevSelectedRows.some((row) => row.id === id && row.index === index)
      ) {
        return prevSelectedRows.filter(
          (row) => row.id !== id || row.index !== index,
        );
      }

      if (
        (e.shiftKey && !prevSelectedRows) ||
        (e.ctrlKey && !prevSelectedRows)
      ) {
        return [{ index, id }];
      } else if (e.shiftKey && prevSelectedRows.length > 0) {
        const min = Math.min(...prevSelectedRows.map((value) => value.index));
        const max = Math.max(...prevSelectedRows.map((value) => value.index));

        const start = (() => {
          if (index >= min && index <= max && direction === 'up') {
            return index;
          } else if (index <= min) {
            setDirection('up');
            return index;
          } else if (direction === 'up') {
            setDirection('down');
            return max;
          } else {
            return min;
          }
        })();

        const end = (() => {
          if (index >= min && index <= max && direction === 'down') {
            return index;
          } else if (index >= max) {
            setDirection('down');
            return index;
          } else if (direction === 'down') {
            setDirection('up');
            return min;
          } else {
            return max;
          }
        })();

        return filteredAndSortedData
          .slice(start, end + 1)
          .map((value, i) => ({ index: start + i, id: value.id }));
      } else if (e.ctrlKey && prevSelectedRows.length > 0) {
        return [...prevSelectedRows, { index, id }];
      } else if (
        prevSelectedRows[0]?.index === index &&
        prevSelectedRows.length === 1
      ) {
        return [];
      } else {
        return [{ index, id }];
      }
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={handleCloseDialog}
        closeButton={true}
        contentClassName="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] overflow-hidden flex flex-col p-6"
      >
        <div
          className="flex flex-col gap-4 flex-1 overflow-hidden"
          style={{ zoom: 0.9 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="h2" className="text-neutral-800">
                Memória Rápida
              </Typography>
              <Typography variant="p" className="text-neutral-600 text-sm mt-1">
                Gerencie as memórias do chatbot
              </Typography>
            </div>
            <div className="flex gap-4 items-center" style={{ zoom: 0.9 }}>
              {hasUnsavedChanges && (
                <Button
                  type="button"
                  onClick={handleSaveChanges}
                  variant="gradient"
                  disabled={loading}
                  className="gap-2 w-fit whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
              )}
              <Button
                type="button"
                onClick={() => loadMemories()}
                variant="gradient"
                disabled={loading}
                className="gap-2 w-fit whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
              <Button
                type="button"
                onClick={handleAddRow}
                variant="gradient"
                className="gap-2 w-fit whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Adicionar Linha
              </Button>
              {selectedRows.length > 0 && (
                <Button
                  type="button"
                  onClick={handleDeleteSelectedRows}
                  variant="gradient"
                  className="gap-2 w-fit whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir ({selectedRows.length})
                </Button>
              )}
            </div>
          </div>

          {/* Tabela */}
          <div
            ref={tableContainerRef}
            className="flex-1 overflow-auto border rounded-lg border-neutral-200"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse">
              <thead className="bg-neutral-100 sticky top-0 z-10">
                <tr className="bg-neutral-100 whitespace-nowrap">
                  <th className="border-l-0 border-t-0 border p-3 text-left">
                    <Typography
                      variant="span"
                      className="text-sm font-semibold text-neutral-700"
                    >
                      #
                    </Typography>
                  </th>
                  {FIXED_SCHEMA.columns.map((col) => (
                    <MemoryColumnHeader
                      key={col.name}
                      column={col}
                      onSort={(direction) => handleSort(col.name, direction)}
                      onFilter={(value) => handleFilter(col.name, value)}
                      onFilterByCondition={(condition, value) =>
                        handleFilterByCondition(col.name, condition, value)
                      }
                      onClearFilter={() => handleClearFilter(col.name)}
                      hasActiveFilter={
                        !!columnFilters[col.name] ||
                        !!columnConditions[col.name] ||
                        sortConfig?.column === col.name
                      }
                      uniqueValues={getUniqueValues(col.name)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="select-none">
                {loading && memoryData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={FIXED_SCHEMA.columns.length + 1}
                      className="border px-3 py-8 text-center"
                    >
                      <Typography variant="span" className="text-neutral-500">
                        Carregando...
                      </Typography>
                    </td>
                  </tr>
                ) : memoryData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={FIXED_SCHEMA.columns.length + 1}
                      className="border px-3 py-8 text-center"
                    >
                      <Typography variant="span" className="text-neutral-500">
                        Nenhuma memória encontrada
                      </Typography>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((row, index) => {
                    const isSelected = selectedRows.some(
                      (r) => r.id === row.id,
                    );
                    const isHighlighted = highlightedRowId === row.id;

                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'cursor-pointer transition-colors duration-300',
                          isSelected
                            ? 'bg-neutral-100 hover:bg-neutral-100'
                            : 'bg-white',
                          isHighlighted && 'bg-yellow-100 animate-pulse',
                        )}
                        onClick={(e) => handleRowClick(e, index, row.id)}
                      >
                        <td className="border border-l-0 px-3">
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-600"
                          >
                            {pagination.startOffset + index + 1}
                          </Typography>
                        </td>
                        {FIXED_SCHEMA.columns.map((col) => {
                          // Mapear nome da coluna para nome do campo no banco
                          const fieldName = getFieldName(col.name);
                          const cellValue = row[fieldName];
                          const isObjectColumn = col.name === 'valor';

                          // Parsear o valor uma vez para usar tanto na exibição quanto na edição
                          // O Prisma já retorna JSON parseado, mas pode vir como string em alguns casos
                          let parsedValue: unknown = cellValue;

                          // Se for string, tentar parsear (caso tenha sido stringificado em algum lugar)
                          if (
                            typeof cellValue === 'string' &&
                            cellValue.trim()
                          ) {
                            try {
                              parsedValue = JSON.parse(cellValue);
                            } catch {
                              // Se não conseguir parsear, manter como string
                              parsedValue = cellValue;
                            }
                          }

                          // Para coluna de objeto/valor, garantir que seja objeto ou array válido
                          if (isObjectColumn) {
                            // Se for null ou undefined, criar objeto vazio
                            if (
                              parsedValue === null ||
                              parsedValue === undefined
                            ) {
                              parsedValue = {};
                            }
                            // Se ainda for string, tentar parsear novamente
                            else if (
                              typeof parsedValue === 'string' &&
                              parsedValue.trim()
                            ) {
                              try {
                                parsedValue = JSON.parse(parsedValue);
                              } catch {
                                parsedValue = {};
                              }
                            }
                          }

                          return (
                            <td
                              key={col.name}
                              className="border px-3 whitespace-nowrap"
                            >
                              {editingCell?.rowId === row.id &&
                              editingCell?.column === col.name ? (
                                <div className="relative">
                                  <input
                                    type={
                                      col.name === 'ttlSeconds'
                                        ? 'number'
                                        : 'text'
                                    }
                                    value={editingValue}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setEditingValue(value);
                                      setValidationError(null);
                                    }}
                                    onBlur={() => {
                                      if (!validationError) {
                                        handleUpdateCell(
                                          row.id,
                                          col.name,
                                          editingValue,
                                          String(cellValue || ''),
                                        );
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === 'Enter' &&
                                        !validationError
                                      ) {
                                        handleUpdateCell(
                                          row.id,
                                          col.name,
                                          editingValue,
                                          String(cellValue || ''),
                                        );
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingCell(null);
                                        setValidationError(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className={`!text-sm w-full rounded-md border p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 ${
                                      validationError
                                        ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                        : 'border-gray-300 bg-white focus:ring-[#5c5e5d]'
                                    }`}
                                  />
                                  {validationError && (
                                    <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700 whitespace-nowrap z-10">
                                      ⚠️ {validationError}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:bg-transparent p-1.5 rounded min-h-[28px] transition-colors"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    // Usar o valor parseado para edição
                                    handleEditCell(
                                      row.id,
                                      col.name,
                                      parsedValue,
                                    );
                                  }}
                                >
                                  {(() => {
                                    if (col.name === 'expiresAt') {
                                      return (
                                        <Typography
                                          variant="span"
                                          className="text-sm text-neutral-600"
                                        >
                                          {cellValue
                                            ? new Date(
                                                cellValue as string,
                                              ).toLocaleString('pt-BR')
                                            : 'Nunca'}
                                        </Typography>
                                      );
                                    }

                                    if (
                                      isObjectColumn &&
                                      typeof parsedValue === 'object' &&
                                      parsedValue !== null &&
                                      !Array.isArray(parsedValue)
                                    ) {
                                      const propCount =
                                        Object.keys(parsedValue).length;
                                      return (
                                        <div className="flex items-center gap-2">
                                          <Typography
                                            variant="span"
                                            className="text-sm text-neutral-400 font-medium"
                                          >
                                            [Objeto com {propCount} propriedade
                                            {propCount !== 1 ? 's' : ''}]
                                          </Typography>
                                          <Typography
                                            variant="span"
                                            className="text-sm text-neutral-400 italic"
                                          >
                                            Duplo clique para editar
                                          </Typography>
                                        </div>
                                      );
                                    } else if (
                                      isObjectColumn &&
                                      Array.isArray(parsedValue)
                                    ) {
                                      return (
                                        <div className="flex items-center gap-2">
                                          <Typography
                                            variant="span"
                                            className="text-sm text-neutral-400 font-medium"
                                          >
                                            [Array com {parsedValue.length} item
                                            {parsedValue.length !== 1
                                              ? 's'
                                              : ''}
                                            ]
                                          </Typography>
                                          <Typography
                                            variant="span"
                                            className="text-sm text-neutral-400 italic"
                                          >
                                            Duplo clique para editar
                                          </Typography>
                                        </div>
                                      );
                                    } else if (String(cellValue || '')) {
                                      return (
                                        <Typography
                                          variant="span"
                                          className="text-sm text-neutral-800"
                                        >
                                          {col.name === 'ttlSeconds' &&
                                          (cellValue === null ||
                                            cellValue === undefined)
                                            ? 'Nunca'
                                            : String(cellValue)}
                                        </Typography>
                                      );
                                    } else {
                                      return (
                                        <Typography
                                          variant="span"
                                          className="text-sm text-neutral-400 italic"
                                        >
                                          Duplo clique para editar
                                        </Typography>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}

                {/* Indicador de carregamento ao rolar */}
                {loadingMore && (
                  <tr>
                    <td
                      colSpan={FIXED_SCHEMA.columns.length + 1}
                      className="border p-4 text-center bg-neutral-50"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
                        <Typography
                          variant="span"
                          className="text-sm text-neutral-500"
                        >
                          Carregando mais registros... (
                          {filteredAndSortedData.length} /{' '}
                          {pagination.totalCount > 0
                            ? pagination.totalCount
                            : '?'}
                          )
                        </Typography>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Indicador de fim dos dados */}
                {!pagination.hasMore &&
                  !loadingMore &&
                  filteredAndSortedData.length > 0 && (
                    <tr>
                      <td
                        colSpan={FIXED_SCHEMA.columns.length + 1}
                        className="border p-3 text-center bg-neutral-50"
                      >
                        <Typography
                          variant="span"
                          className="text-sm text-neutral-500"
                        >
                          Todas as {pagination.totalCount} linhas foram
                          carregadas
                        </Typography>
                      </td>
                    </tr>
                  )}

                {/* Mensagem quando não há dados */}
                {filteredAndSortedData.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={FIXED_SCHEMA.columns.length + 1}
                      className="border p-12 text-center"
                    >
                      <Typography variant="p" className="text-neutral-500">
                        {Object.keys(columnFilters).length > 0 ||
                        Object.keys(columnConditions).length > 0
                          ? 'Nenhum registro corresponde aos filtros aplicados.'
                          : 'Nenhuma memória encontrada. Adicione uma linha para começar.'}
                      </Typography>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Indicador de carregamento fixo no topo (visível independente do scroll horizontal) */}
            {loadingMoreBefore && (
              <div className="sticky top-0 left-0 right-0 z-30 bg-neutral-50 border-b border-neutral-200 p-4 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
                <Typography variant="span" className="text-sm text-neutral-500">
                  Carregando registros anteriores... (
                  {filteredAndSortedData.length} /{' '}
                  {pagination.totalCount > 0 ? pagination.totalCount : '?'})
                </Typography>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Dialog de aviso ao fechar com mudanças não salvas */}
      {showCloseWarning && (
        <Dialog
          isOpen={showCloseWarning}
          onClose={handleCancelClose}
          closeButton={false}
          contentClassName="max-w-md"
        >
          <div className="flex flex-col gap-4 p-6">
            <Typography variant="h3" className="text-neutral-800">
              Descartar mudanças?
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Você tem mudanças não salvas. Deseja descartá-las e fechar?
            </Typography>
            <div className="flex gap-3 justify-end">
              <Button type="button" onClick={handleCancelClose} variant="ghost">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmClose}
                variant="gradient"
              >
                Descartar e Fechar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Dialog para editar array */}
      {showEditArrayDialog && editingArrayData && (
        <EditArrayDialog
          isOpen={showEditArrayDialog}
          onClose={() => {
            setShowEditArrayDialog(false);
            setEditingArrayData(null);
          }}
          initialArray={editingArrayData.array}
          columnName={editingArrayData.column}
          onSave={(updatedArray) => {
            setPendingChanges((prev) => ({
              ...prev,
              updates: [
                ...prev.updates.filter(
                  (u) =>
                    !(
                      u.rowId === editingArrayData.rowId &&
                      u.column === editingArrayData.column
                    ),
                ),
                {
                  rowId: editingArrayData.rowId,
                  column: editingArrayData.column,
                  value: updatedArray,
                },
              ],
            }));

            setMemoryData((prev) =>
              prev.map((r) =>
                r.id === editingArrayData.rowId
                  ? { ...r, [editingArrayData.column]: updatedArray }
                  : r,
              ),
            );

            setHasUnsavedChanges(true);
            setShowEditArrayDialog(false);
            setEditingArrayData(null);
          }}
        />
      )}

      {/* Dialog para editar objeto */}
      {showEditObjectDialog && editingObjectData && (
        <EditObjectDialog
          isOpen={showEditObjectDialog}
          onClose={() => {
            setShowEditObjectDialog(false);
            setEditingObjectData(null);
          }}
          initialObject={editingObjectData.object}
          columnName={editingObjectData.column}
          onSave={(updatedObject: Record<string, unknown>) => {
            setPendingChanges((prev) => ({
              ...prev,
              updates: [
                ...prev.updates.filter(
                  (u) =>
                    !(
                      u.rowId === editingObjectData.rowId &&
                      u.column === editingObjectData.column
                    ),
                ),
                {
                  rowId: editingObjectData.rowId,
                  column: editingObjectData.column,
                  value: updatedObject,
                },
              ],
            }));

            setMemoryData((prev) =>
              prev.map((r) =>
                r.id === editingObjectData.rowId
                  ? { ...r, [editingObjectData.column]: updatedObject }
                  : r,
              ),
            );

            setHasUnsavedChanges(true);
            setShowEditObjectDialog(false);
            setEditingObjectData(null);
          }}
        />
      )}

      {/* Dialog para editar valor (spreadsheet chave-valor) */}
      {showKeyValueSpreadsheet && editingValueData && (
        <KeyValueSpreadsheet
          isOpen={showKeyValueSpreadsheet}
          onClose={() => {
            setShowKeyValueSpreadsheet(false);
            setEditingValueData(null);
          }}
          initialData={editingValueData.object}
          isArray={editingValueData.isArray}
          onSave={(updatedValue) => {
            setPendingChanges((prev) => ({
              ...prev,
              updates: [
                ...prev.updates.filter(
                  (u) =>
                    !(
                      u.rowId === editingValueData.rowId &&
                      u.column === editingValueData.column
                    ),
                ),
                {
                  rowId: editingValueData.rowId,
                  column: editingValueData.column,
                  value: updatedValue,
                },
              ],
            }));

            // Atualizar estado local - mapear nome da coluna para nome do campo
            const fieldName = getFieldName(editingValueData.column);
            setMemoryData((prev) =>
              prev.map((r) =>
                r.id === editingValueData.rowId
                  ? { ...r, [fieldName]: updatedValue }
                  : r,
              ),
            );

            setHasUnsavedChanges(true);
            setShowKeyValueSpreadsheet(false);
            setEditingValueData(null);
          }}
        />
      )}
    </>
  );
}
