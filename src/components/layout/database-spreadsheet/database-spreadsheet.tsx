'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type FilterCondition } from './column-filter';
import { DraggableColumnHeader } from './draggable-column-header';
import { EditColumnDialog } from '@/components/features/forms/database-spreadsheet/edit-table-column/edit-table-column';
import { DeleteColumnDialog } from './delete-column';
import {
  getAvailableTables,
  getTableData,
  updateCell,
  addRow,
  deleteRow,
  createTable,
  addColumnsToTable,
  updateColumnMetadata,
  renameColumn,
  deleteColumn,
  reorderColumns,
  renameTable,
  deleteTable,
  checkDuplicatesForUniqueColumn,
  removeDuplicates,
} from '@/actions/database/operations';
import { CreateTableDialog } from '../../features/forms/database-spreadsheet/create-database-table/create-database-table';
import { AddColumnDialog } from '../../features/forms/database-spreadsheet/add-table-column/add-table-column';
import { EditArrayDialog } from './edit-array';
import { EditObjectDialog } from './edit-object';
import { TableActions } from './table-actions';
import { RenameTableDialog } from './rename-table-dialog';
import { DeleteTableDialog } from './delete-table-dialog';
import { cn } from '@/lib/utils';

interface DatabaseSpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TableData {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  [key: string]: unknown;
}

interface TableSchema {
  columns: Array<{
    name: string;
    type: string;
    default: unknown;
    required: boolean;
    unique?: boolean;
  }>;
}

export function DatabaseSpreadsheet({
  isOpen,
  onClose,
}: DatabaseSpreadsheetProps) {
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [tableSchema, setTableSchema] = useState<TableSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<{
    offset: number;
    totalCount: number;
    hasMore: boolean;
  }>({
    offset: 0,
    totalCount: 0,
    hasMore: false,
  });
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    column: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<
    { index: number; id: string }[]
  >([]);
  const [direction, setDirection] = useState<'up' | 'down' | undefined>(
    undefined,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    updates: Array<{ rowId: string; column: string; value: string }>;
    additions: Array<Record<string, unknown>>;
    deletions: Array<string>;
    columnRenames: Array<{ oldName: string; newName: string }>;
    columnMetadataUpdates: Array<{
      columnName: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
      required: boolean;
      default: string;
      unique?: boolean;
    }>;
    columnDeletions: Array<string>;
    columnReorder: boolean;
  }>({
    updates: [],
    additions: [],
    deletions: [],
    columnRenames: [],
    columnMetadataUpdates: [],
    columnDeletions: [],
    columnReorder: false,
  });
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
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false);
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
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

  const [showEditColumnDialog, setShowEditColumnDialog] = useState(false);
  const [editingColumnData, setEditingColumnData] = useState<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required: boolean;
    default: string;
    unique?: boolean;
  } | null>(null);
  const [showDeleteColumnDialog, setShowDeleteColumnDialog] = useState(false);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [duplicatesData, setDuplicatesData] = useState<{
    columnName: string;
    duplicates: Array<{ value: any; count: number; ids: string[] }>;
  } | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<string>('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showRenameTableDialog, setShowRenameTableDialog] = useState(false);
  const [renamingTable, setRenamingTable] = useState<string>('');
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false);
  const [deletingTable, setDeletingTable] = useState<string>('');

  // Carregar tabelas disponíveis
  useEffect(() => {
    if (isOpen) {
      loadAvailableTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Limpar estados quando fechar o dialog
  useEffect(() => {
    if (!isOpen) {
      setSelectedTable('');
      setTableData([]);
      setTableSchema(null);
      setSelectedRows([]);
      setEditingCell(null);
      setEditingValue('');
      setHasUnsavedChanges(false);
      setPagination({ offset: 0, totalCount: 0, hasMore: false });
      setPendingChanges({
        updates: [],
        additions: [],
        deletions: [],
        columnRenames: [],
        columnMetadataUpdates: [],
        columnDeletions: [],
        columnReorder: false,
      });
    }
  }, [isOpen]);

  // Limpar seleção quando mudar de tabela
  useEffect(() => {
    setSelectedRows([]);
  }, [tableData]);

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

  // Carregar dados da tabela selecionada
  useEffect(() => {
    if (selectedTable) {
      loadTableData();
      // Limpar mudanças pendentes ao mudar de tabela
      setPendingChanges({
        updates: [],
        additions: [],
        deletions: [],
        columnRenames: [],
        columnMetadataUpdates: [],
        columnDeletions: [],
        columnReorder: false,
      });
      setHasUnsavedChanges(false);
      // Limpar filtros e ordenação
      setColumnFilters({});
      setColumnConditions({});
      setSortConfig(null);
      // Resetar paginação
      setPagination({ offset: 0, totalCount: 0, hasMore: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable]);

  const loadAvailableTables = async () => {
    try {
      setLoading(true);
      const response = await getAvailableTables();
      if (response.success && Array.isArray(response.data)) {
        setAvailableTables(response.data);
      } else {
        console.error('Erro ao carregar tabelas:', response.message);
        setAvailableTables([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tabelas:', error);
      setAvailableTables([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setTableData([]);
        setPagination({ offset: 0, totalCount: 0, hasMore: false });
      }

      const currentOffset = append ? pagination.offset : 0;
      const response = await getTableData(selectedTable, {
        offset: currentOffset,
        limit: 100,
      });

      if (response.success && response.data) {
        const tableResponse = response.data as {
          data: TableData[];
          schema: TableSchema | null;
          totalCount?: number;
          hasMore?: boolean;
        };

        if (append) {
          // Adicionar novos dados aos existentes
          setTableData((prev) => [...prev, ...(tableResponse.data || [])]);
        } else {
          // Primeira carga - substituir dados
          setTableData(tableResponse.data || []);
          setTableSchema(tableResponse.schema || null);
        }

        // Atualizar estado de paginação
        setPagination({
          offset: currentOffset + (tableResponse.data?.length || 0),
          totalCount: tableResponse.totalCount || 0,
          hasMore: tableResponse.hasMore || false,
        });

        // Atualizar schema apenas na primeira carga
        if (!append && tableResponse.schema) {
          setTableSchema(tableResponse.schema);
        }
      } else {
        console.error('Erro ao carregar dados:', response.message);
        if (!append) {
          setTableData([]);
          setTableSchema(null);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      if (!append) {
        setTableData([]);
        setTableSchema(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Handler para scroll infinito
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Carregar mais quando estiver a 200px do final
    const threshold = 200;
    if (
      scrollHeight - scrollTop - clientHeight < threshold &&
      pagination.hasMore &&
      !loadingMore &&
      !loading
    ) {
      loadTableData(true);
    }
  };

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

    // Atualizar estado local
    setTableData((prev) =>
      prev.map((row) =>
        row._id === rowId
          ? {
              ...row,
              [column]: value,
              _updatedAt: new Date().toISOString(),
            }
          : row,
      ),
    );

    // Adicionar às mudanças pendentes
    setPendingChanges((prev) => {
      // Verificar se a linha está nas adições pendentes
      const additionIndex = prev.additions.findIndex(
        (add) => add._id === rowId,
      );

      if (additionIndex >= 0) {
        // Se for uma linha nova, atualizar diretamente no objeto de adição
        const newAdditions = [...prev.additions];
        newAdditions[additionIndex] = {
          ...newAdditions[additionIndex],
          [column]: value,
          _updatedAt: new Date().toISOString(),
        };
        return { ...prev, additions: newAdditions };
      } else {
        // Se for uma linha existente, adicionar às atualizações
        const existingIndex = prev.updates.findIndex(
          (u) => u.rowId === rowId && u.column === column,
        );

        if (existingIndex >= 0) {
          // Atualizar mudança existente
          const newUpdates = [...prev.updates];
          newUpdates[existingIndex] = { rowId, column, value };
          return { ...prev, updates: newUpdates };
        } else {
          // Adicionar nova mudança
          return {
            ...prev,
            updates: [...prev.updates, { rowId, column, value }],
          };
        }
      }
    });

    setHasUnsavedChanges(true);
    setEditingCell(null);
    setValidationError(null);
  };

  const handleAddRow = () => {
    if (!tableSchema) return;

    const newRow: Record<string, unknown> = {
      _id: crypto.randomUUID(),
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
    };

    tableSchema.columns.forEach((col) => {
      newRow[col.name] = col.default || '';
    });

    // Adicionar ao estado local
    setTableData((prev) => [...prev, newRow as TableData]);

    // Adicionar às mudanças pendentes
    setPendingChanges((prev) => ({
      ...prev,
      additions: [...prev.additions, newRow],
    }));

    setHasUnsavedChanges(true);
  };

  const handleDeleteSelectedRows = () => {
    const selectedIds = selectedRows.map((row) => row.id);

    // Remover do estado local
    setTableData((prev) =>
      prev.filter((row) => !selectedIds.includes(row._id)),
    );

    // Adicionar às mudanças pendentes (apenas IDs que não são adições pendentes)
    setPendingChanges((prev) => {
      const newDeletions = selectedIds.filter(
        (id) => !prev.additions.some((add) => add._id === id),
      );

      // Remover adições pendentes que foram deletadas
      const newAdditions = prev.additions.filter(
        (add) => !selectedIds.includes(add._id as string),
      );

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
    try {
      setLoading(true);

      // Processar renomeações de colunas primeiro (antes dos metadados)
      for (const rename of pendingChanges.columnRenames) {
        const response = await renameColumn(
          selectedTable,
          rename.oldName,
          rename.newName,
        );
        if (!response.success) {
          console.error('Erro ao renomear coluna:', response.message);
          alert(`Erro ao renomear coluna: ${response.message}`);
        }
      }

      // Processar atualizações de metadados de colunas
      for (const metadata of pendingChanges.columnMetadataUpdates) {
        const response = await updateColumnMetadata(
          selectedTable,
          metadata.columnName,
          {
            type: metadata.type,
            required: metadata.required,
            default: metadata.default,
            unique: metadata.unique,
          },
        );
        if (!response.success) {
          console.error(
            'Erro ao atualizar metadados da coluna:',
            response.message,
          );
          alert(`Erro ao atualizar metadados da coluna: ${response.message}`);
        }
      }

      // Processar exclusões de colunas
      for (const columnName of pendingChanges.columnDeletions) {
        const response = await deleteColumn(selectedTable, columnName);
        if (!response.success) {
          console.error('Erro ao excluir coluna:', response.message);
          alert(`Erro ao excluir coluna: ${response.message}`);
        }
      }

      // Processar reordenação de colunas
      if (pendingChanges.columnReorder && tableSchema) {
        const response = await reorderColumns(
          selectedTable,
          tableSchema.columns,
        );
        if (!response.success) {
          console.error('Erro ao reordenar colunas:', response.message);
          alert(`Erro ao reordenar colunas: ${response.message}`);
        }
      }

      // Processar todas as atualizações
      for (const update of pendingChanges.updates) {
        const response = await updateCell(
          selectedTable,
          update.rowId,
          update.column,
          update.value,
        );
        if (!response.success) {
          console.error('Erro ao atualizar célula:', response.message);
          alert(`Erro ao atualizar célula: ${response.message}`);
        }
      }

      // Processar todas as adições
      for (const addition of pendingChanges.additions) {
        const response = await addRow(selectedTable, addition);
        if (!response.success) {
          console.error('Erro ao adicionar linha:', response.message);
          alert(`Erro ao adicionar linha: ${response.message}`);
        }
      }

      // Processar todas as deleções
      for (const deletionId of pendingChanges.deletions) {
        const response = await deleteRow(selectedTable, deletionId);
        if (!response.success) {
          console.error('Erro ao deletar linha:', response.message);
        }
      }

      // Limpar mudanças pendentes
      setPendingChanges({
        updates: [],
        additions: [],
        deletions: [],
        columnRenames: [],
        columnMetadataUpdates: [],
        columnDeletions: [],
        columnReorder: false,
      });
      setHasUnsavedChanges(false);

      // Recarregar dados da tabela para sincronizar (resetar paginação)
      setPagination({ offset: 0, totalCount: 0, hasMore: false });
      await loadTableData();
    } catch (error) {
      console.error('Erro ao salvar mudanças:', error);
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
      columnRenames: [],
      columnMetadataUpdates: [],
      columnDeletions: [],
      columnReorder: false,
    });
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseWarning(false);
  };

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortConfig({ column, direction });
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
    // Clear sorting if this column has active sorting
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

  const handleCreateTable = async (
    tableName: string,
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
      required: boolean;
      default: string;
    }>,
  ) => {
    try {
      setLoading(true);
      const response = await createTable(tableName, columns);
      if (response.success) {
        // Recarregar lista de tabelas
        await loadAvailableTables();
        // Selecionar a tabela recém-criada
        setSelectedTable(tableName);
      } else {
        console.error('Erro ao criar tabela:', response.message);
        alert(response.message || 'Erro ao criar tabela');
      }
    } catch (error) {
      console.error('Erro ao criar tabela:', error);
      alert('Erro ao criar tabela');
    } finally {
      setLoading(false);
    }
  };

  const handleAddColumns = async (
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
      required: boolean;
      default: string;
    }>,
  ) => {
    try {
      setLoading(true);
      const response = await addColumnsToTable(selectedTable, columns);
      if (response.success) {
        // Recarregar dados da tabela para mostrar as novas colunas
        await loadTableData();
        setShowAddColumnDialog(false);
      } else {
        console.error('Erro ao adicionar colunas:', response.message);
        alert(response.message || 'Erro ao adicionar colunas');
      }
    } catch (error) {
      console.error('Erro ao adicionar colunas:', error);
      alert('Erro ao adicionar colunas');
    } finally {
      setLoading(false);
    }
  };

  // Função para validar valor em tempo real
  const validateCellValue = (
    value: string,
    columnType: string,
  ): string | null => {
    if (!value || value.trim() === '') {
      return null; // Valores vazios são permitidos
    }

    switch (columnType) {
      case 'string':
        return null; // Strings sempre são válidas

      case 'number':
        const num = Number(value);
        if (isNaN(num) || !isFinite(num)) {
          return `"${value}" não é um número válido`;
        }
        return null;

      case 'boolean':
        const lowerValue = value.toLowerCase();
        if (
          !['true', 'false', '1', '0', 'sim', 'não', 'yes', 'no'].includes(
            lowerValue,
          )
        ) {
          return `"${value}" não é um booleano válido (true/false)`;
        }
        return null;

      case 'date':
        // Rejeitar timestamps Unix puros
        if (/^\d+$/.test(value)) {
          return `"${value}" não é uma data válida (use DD/MM/AAAA ou AAAA-MM-DD)`;
        }

        // Aceitar formatos ISO 8601 ou DD/MM/YYYY
        const isoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        const brDate = /^\d{2}\/\d{2}\/\d{4}$/;

        if (isoDate.test(value) || brDate.test(value)) {
          const parsed = new Date(value);
          if (isNaN(parsed.getTime())) {
            return `"${value}" não é uma data válida`;
          }
          return null;
        }

        return `"${value}" não é uma data válida (use DD/MM/AAAA ou AAAA-MM-DD)`;

      case 'array':
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            return `"${value}" não é um array válido`;
          }
          return null;
        } catch {
          return `"${value}" não é um array JSON válido`;
        }

      case 'object':
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            return `"${value}" não é um objeto válido`;
          }
          return null;
        } catch {
          return `"${value}" não é um objeto JSON válido`;
        }

      default:
        return null;
    }
  };

  const handleEditCell = (
    rowId: string,
    column: string,
    currentValue: unknown,
  ) => {
    // Verificar se a coluna é do tipo array ou object no schema
    const columnSchema = tableSchema?.columns.find(
      (col) => col.name === column,
    );
    const isArrayColumn = columnSchema?.type === 'array';
    const isObjectColumn = columnSchema?.type === 'object';

    // Verificar se é array
    if (Array.isArray(currentValue) || isArrayColumn) {
      let arrayValue: unknown[] = [];

      if (Array.isArray(currentValue)) {
        arrayValue = currentValue;
      } else if (typeof currentValue === 'string' && currentValue.trim()) {
        // Tentar fazer parse de JSON se for string
        try {
          const parsed = JSON.parse(currentValue);
          if (Array.isArray(parsed)) {
            arrayValue = parsed;
          }
        } catch {
          // Se não conseguir fazer parse, criar array com o valor atual
          arrayValue = [currentValue];
        }
      }

      setEditingArrayData({
        rowId,
        column,
        array: arrayValue,
      });
      setShowEditArrayDialog(true);
    }
    // Verificar se é object
    else if (
      (typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(currentValue)) ||
      isObjectColumn
    ) {
      let objectValue: Record<string, unknown> = {};

      if (
        typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(currentValue)
      ) {
        objectValue = currentValue as Record<string, unknown>;
      } else if (typeof currentValue === 'string' && currentValue.trim()) {
        // Tentar fazer parse de JSON se for string
        try {
          const parsed = JSON.parse(currentValue);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            objectValue = parsed;
          }
        } catch {
          // Se não conseguir fazer parse, criar objeto vazio
          objectValue = {};
        }
      }

      setEditingObjectData({
        rowId,
        column,
        object: objectValue,
      });
      setShowEditObjectDialog(true);
    } else {
      // Se não for array nem object, abrir edição normal
      setEditingCell({
        rowId,
        column,
      });
      setEditingValue(String(currentValue || ''));
      setValidationError(null);
    }
  };

  const handleSaveArray = (newArray: unknown[]) => {
    if (!editingArrayData) return;

    const arrayString = JSON.stringify(newArray);
    const originalArrayString = JSON.stringify(editingArrayData.array);

    handleUpdateCell(
      editingArrayData.rowId,
      editingArrayData.column,
      arrayString,
      originalArrayString,
    );

    setShowEditArrayDialog(false);
    setEditingArrayData(null);
  };

  const handleSaveObject = (newObject: Record<string, unknown>) => {
    if (!editingObjectData) return;

    const objectString = JSON.stringify(newObject);
    const originalObjectString = JSON.stringify(editingObjectData.object);

    handleUpdateCell(
      editingObjectData.rowId,
      editingObjectData.column,
      objectString,
      originalObjectString,
    );

    setShowEditObjectDialog(false);
    setEditingObjectData(null);
  };

  const handleEditColumn = async (updatedColumn: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required: boolean;
    default: string;
    unique?: boolean;
  }) => {
    if (!editingColumnData) return;

    const oldName = editingColumnData.name;
    const finalColumnName = updatedColumn.name; // Nome final após renomeação (se houver)

    // Verificar se o novo nome já existe (e não é o nome atual)
    if (updatedColumn.name !== oldName) {
      const columnExists = tableSchema?.columns.some(
        (col) => col.name === updatedColumn.name && col.name !== oldName,
      );

      if (columnExists) {
        alert('Já existe uma coluna com esse nome');
        throw new Error('Já existe uma coluna com esse nome');
      }
    }

    // Se ativou UNIQUE, verificar duplicatas
    const wasUnique = (editingColumnData as any).unique || false;
    const isNowUnique = updatedColumn.unique || false;

    if (isNowUnique && !wasUnique) {
      const response = await checkDuplicatesForUniqueColumn(
        selectedTable,
        oldName,
      );

      if (
        response.success &&
        response.data &&
        (response.data as any[]).length > 0
      ) {
        // Mostrar modal de confirmação
        setDuplicatesData({
          columnName: oldName,
          duplicates: response.data as any[],
        });
        setShowDuplicatesDialog(true);
        // Guardar updatedColumn temporariamente para usar após confirmação
        (window as any).__pendingColumnUpdate = updatedColumn;
        return; // Aguardar decisão do usuário
      }
    }

    // Se o nome mudou, adicionar/atualizar renomeação
    if (updatedColumn.name !== oldName) {
      const existingRenameIndex = pendingChanges.columnRenames.findIndex(
        (r) => r.oldName === oldName,
      );

      if (existingRenameIndex >= 0) {
        const newRenames = [...pendingChanges.columnRenames];
        newRenames[existingRenameIndex].newName = updatedColumn.name;
        setPendingChanges((prev) => ({
          ...prev,
          columnRenames: newRenames,
        }));
      } else {
        setPendingChanges((prev) => ({
          ...prev,
          columnRenames: [
            ...prev.columnRenames,
            { oldName, newName: updatedColumn.name },
          ],
        }));
      }
    }

    // Se tipo, required, default ou unique mudaram, adicionar/atualizar metadados
    if (
      updatedColumn.type !== editingColumnData.type ||
      updatedColumn.required !== editingColumnData.required ||
      updatedColumn.default !== editingColumnData.default ||
      (updatedColumn.unique || false) !==
        ((editingColumnData as any).unique || false)
    ) {
      const existingMetadataIndex =
        pendingChanges.columnMetadataUpdates.findIndex(
          (m) => m.columnName === oldName,
        );

      const metadataUpdate = {
        columnName: finalColumnName, // Usar o nome final (após renomeação)
        type: updatedColumn.type,
        required: updatedColumn.required,
        default: updatedColumn.default,
        unique: updatedColumn.unique,
      };

      if (existingMetadataIndex >= 0) {
        const newMetadata = [...pendingChanges.columnMetadataUpdates];
        newMetadata[existingMetadataIndex] = metadataUpdate;
        setPendingChanges((prev) => ({
          ...prev,
          columnMetadataUpdates: newMetadata,
        }));
      } else {
        setPendingChanges((prev) => ({
          ...prev,
          columnMetadataUpdates: [
            ...prev.columnMetadataUpdates,
            metadataUpdate,
          ],
        }));
      }
    }

    // Atualizar o schema local para refletir todas as mudanças
    if (tableSchema) {
      const updatedSchema = {
        ...tableSchema,
        columns: tableSchema.columns.map((col) =>
          col.name === oldName
            ? {
                name: updatedColumn.name,
                type: updatedColumn.type,
                required: updatedColumn.required,
                default: updatedColumn.default,
                unique: updatedColumn.unique,
              }
            : col,
        ),
      };
      setTableSchema(updatedSchema);
    }

    setHasUnsavedChanges(true);
    setShowEditColumnDialog(false);
    setEditingColumnData(null);
  };

  // Handler para remover duplicatas ao ativar UNIQUE
  const handleRemoveDuplicates = async () => {
    if (!duplicatesData) return;

    // Manter apenas o primeiro ID de cada grupo, remover os demais
    const idsToRemove: string[] = [];

    for (const dup of duplicatesData.duplicates) {
      idsToRemove.push(...dup.ids.slice(1)); // Remove todos exceto o primeiro
    }

    const response = await removeDuplicates(
      selectedTable,
      duplicatesData.columnName,
      idsToRemove,
    );

    if (response.success) {
      // Continuar com a atualização da coluna
      const pendingUpdate = (window as any).__pendingColumnUpdate;
      if (pendingUpdate) {
        delete (window as any).__pendingColumnUpdate;
        // Chamar handleEditColumn novamente, mas agora sem duplicatas
        await handleEditColumn(pendingUpdate);
      }

      await loadTableData();
      setShowDuplicatesDialog(false);
      setDuplicatesData(null);
    } else {
      alert(`Erro ao remover duplicatas: ${response.message}`);
    }
  };

  // Handler para cancelar remoção de duplicatas
  const handleCancelRemoveDuplicates = () => {
    setShowDuplicatesDialog(false);
    setDuplicatesData(null);
    delete (window as any).__pendingColumnUpdate;
  };

  // Funções de drag and drop
  const handleDragStart = (index: number) => {
    setDraggedColumn(tableSchema?.columns[index].name || null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverColumn(tableSchema?.columns[index].name || null);
  };

  const handleDrop = (dropIndex: number) => {
    if (!tableSchema || draggedColumn === null) return;

    const dragIndex = tableSchema.columns.findIndex(
      (col) => col.name === draggedColumn,
    );

    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    // Reordenar colunas no schema
    const newColumns = [...tableSchema.columns];
    const [draggedCol] = newColumns.splice(dragIndex, 1);
    newColumns.splice(dropIndex, 0, draggedCol);

    setTableSchema({
      ...tableSchema,
      columns: newColumns,
    });

    // Reordenar dados da tabela
    const reorderedData = tableData.map((row) => {
      const newRow: Record<string, unknown> = {};
      newColumns.forEach((col) => {
        newRow[col.name] = row[col.name];
      });
      // Manter campos do sistema
      newRow._id = row._id;
      newRow._createdAt = row._createdAt;
      newRow._updatedAt = row._updatedAt;
      return newRow as TableData;
    });

    setTableData(reorderedData);
    setHasUnsavedChanges(true);

    // Marcar que houve reordenação
    setPendingChanges((prev) => ({
      ...prev,
      columnReorder: true,
    }));

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDeleteColumn = () => {
    // Verificar se é a última coluna
    if (tableSchema && tableSchema.columns.length === 1) {
      alert('Não é possível excluir a última coluna da tabela');
      return;
    }

    // Adicionar às exclusões pendentes
    setPendingChanges((prev) => ({
      ...prev,
      columnDeletions: [...prev.columnDeletions, deletingColumn],
    }));

    // Atualizar o schema local para refletir a mudança
    if (tableSchema) {
      const updatedSchema = {
        ...tableSchema,
        columns: tableSchema.columns.filter(
          (col) => col.name !== deletingColumn,
        ),
      };
      setTableSchema(updatedSchema);
    }

    // Remover dados da coluna do tableData local
    setTableData((prev) =>
      prev.map((row) => {
        const newRow = { ...row };
        delete newRow[deletingColumn];
        return newRow;
      }),
    );

    setHasUnsavedChanges(true);
    setShowDeleteColumnDialog(false);
    setDeletingColumn('');
  };

  const handleRenameTable = async (oldName: string, newName: string) => {
    try {
      setLoading(true);
      const response = await renameTable(oldName, newName);
      if (response.success) {
        // Recarregar lista de tabelas
        await loadAvailableTables();
        // Se a tabela renomeada está selecionada, atualizar seleção
        if (selectedTable === oldName) {
          setSelectedTable(newName);
        }
      } else {
        console.error('Erro ao renomear tabela:', response.message);
        alert(response.message || 'Erro ao renomear tabela');
      }
    } catch (error) {
      console.error('Erro ao renomear tabela:', error);
      alert('Erro ao renomear tabela');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async () => {
    try {
      setLoading(true);
      const response = await deleteTable(deletingTable);
      if (response.success) {
        // Se a tabela deletada estava selecionada, limpar seleção
        if (selectedTable === deletingTable) {
          setSelectedTable('');
          setTableData([]);
          setTableSchema(null);
        }
        // Recarregar lista de tabelas
        await loadAvailableTables();
      } else {
        console.error('Erro ao deletar tabela:', response.message);
        alert(response.message || 'Erro ao deletar tabela');
      }
    } catch (error) {
      console.error('Erro ao deletar tabela:', error);
      alert('Erro ao deletar tabela');
    } finally {
      setLoading(false);
    }
  };

  // Dados filtrados e ordenados
  const filteredAndSortedData = React.useMemo(() => {
    let data = [...tableData];

    // Aplicar filtros por valor
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      data = data.filter((row) =>
        String(row[column]).toLowerCase().includes(filterValue.toLowerCase()),
      );
    });

    // Aplicar filtros por condição
    Object.entries(columnConditions).forEach(
      ([column, { condition, value }]) => {
        data = data.filter((row) => {
          const cellValue = String(row[column] || '').toLowerCase();

          switch (condition) {
            case 'isEmpty':
              return cellValue === '';
            case 'isNotEmpty':
              return cellValue !== '';
            case 'contains':
              return value ? cellValue.includes(value.toLowerCase()) : true;
            case 'notContains':
              return value ? !cellValue.includes(value.toLowerCase()) : true;
            case 'startsWith':
              return value ? cellValue.startsWith(value.toLowerCase()) : true;
            case 'endsWith':
              return value ? cellValue.endsWith(value.toLowerCase()) : true;
            case 'equals':
              return value ? cellValue === value.toLowerCase() : true;
            default:
              return true;
          }
        });
      },
    );

    // Aplicar ordenação
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = String(a[sortConfig.column] || '');
        const bValue = String(b[sortConfig.column] || '');

        if (sortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    return data;
  }, [tableData, columnFilters, columnConditions, sortConfig]);

  // Obter valores únicos de uma coluna
  const getUniqueValues = (columnName: string) => {
    return Array.from(
      new Set(tableData.map((row) => String(row[columnName] || ''))),
    );
  };

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

        return tableData
          .slice(start, end + 1)
          .map((value, i) => ({ index: start + i, id: value._id }));
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
          {/* <div className="flex items-center gap-3">
            <Typography
              variant="h2"
              className="text-neutral-600 flex items-center gap-2"
            >
              📦 Banco de Dados
            </Typography>
          </div> */}

          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Sidebar de tabelas */}
            <div className="w-64 border rounded-lg border-neutral-200 flex flex-col gap-2 overflow-y-auto bg-neutral-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <Typography
                  variant="h4"
                  className="text-md font-semibold text-neutral-700"
                >
                  Tabelas
                </Typography>
                <Button
                  type="button"
                  variant="gradient"
                  onClick={() => setShowCreateTableDialog(true)}
                  className="!p-1.5 !h-auto !w-auto"
                  title="Criar nova tabela"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>
              <Typography variant="p" className="text-sm text-neutral-700 mb-2">
                Selecione uma tabela para editar
              </Typography>
              {loading && availableTables.length === 0 ? (
                <div className="text-sm text-neutral-500">Carregando...</div>
              ) : availableTables.length === 0 ? (
                <div className="text-sm text-neutral-500">
                  Nenhuma tabela encontrada
                </div>
              ) : (
                availableTables.map((table) => (
                  <div
                    key={table}
                    className={cn(
                      'flex items-center justify-between w-full gap-2 group rounded-md text-sm transition-colors bg-white',
                      selectedTable === table
                        ? 'border border-neutral-300 shadow-md ring-1 ring-neutral-400'
                        : 'border border-neutral-200',
                    )}
                  >
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedTable(table)}
                      className={`flex-1 px-3 !py-1 rounded-md text-sm transition-colors ${
                        selectedTable === table
                          ? 'bg-white text-neutral-700 font-semibold '
                          : 'bg-white text-neutral-700 font-medium'
                      }`}
                      textClassName="justify-start"
                    >
                      {table}
                    </Button>
                    <div>
                      <TableActions
                        tableName={table}
                        onRename={(tableName) => {
                          setRenamingTable(tableName);
                          setShowRenameTableDialog(true);
                        }}
                        onDelete={(tableName) => {
                          setDeletingTable(tableName);
                          setShowDeleteTableDialog(true);
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-end justify-between gap-4">
                {selectedTable && (
                  <div className="flex items-center gap-6 border p-2 rounded-lg bg-neutral-50 shadow-md">
                    <div>
                      <Typography
                        variant="span"
                        className="text-sm text-neutral-700"
                      >
                        Tabela
                      </Typography>
                      <Typography variant="h2" className="text-neutral-600">
                        {selectedTable}
                      </Typography>
                    </div>
                    {hasUnsavedChanges && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">
                        Alterações não salvas
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-4 items-center justify-end">
                  {hasUnsavedChanges && (
                    <Button
                      type="button"
                      onClick={handleSaveChanges}
                      variant="gradient"
                      bgHexColor="#70f051"
                      disabled={loading}
                      className="gap-2 w-fit whitespace-nowrap"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </Button>
                  )}
                  {selectedTable && (
                    <Button
                      type="button"
                      onClick={loadTableData}
                      variant="gradient"
                      bgHexColor="#65b8f4"
                      disabled={loading}
                      className="gap-2 w-fit whitespace-nowrap"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                      />
                      Atualizar
                    </Button>
                  )}
                  {selectedTable && (
                    <Button
                      type="button"
                      onClick={handleAddRow}
                      variant="gradient"
                      disabled={!tableSchema}
                      className="gap-2 w-fit whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Linha
                    </Button>
                  )}
                  {selectedTable && (
                    <Button
                      type="button"
                      onClick={() => setShowAddColumnDialog(true)}
                      variant="gradient"
                      bgHexColor="#8b5cf6"
                      className="gap-2 w-fit whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Coluna
                    </Button>
                  )}
                  {selectedRows.length > 0 && (
                    <Button
                      type="button"
                      onClick={handleDeleteSelectedRows}
                      variant="gradient"
                      bgHexColor="#ef4444"
                      className="gap-2 w-fit whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" />
                      Deletar {selectedRows.length}{' '}
                      {selectedRows.length === 1 ? 'linha' : 'linhas'}
                    </Button>
                  )}
                </div>
              </div>

              {selectedTable && tableSchema && (
                <div
                  className="flex-1 overflow-auto rounded-lg border-neutral-200 border"
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
                        {tableSchema.columns.map((col, index) => (
                          <DraggableColumnHeader
                            key={col.name}
                            column={col}
                            index={index}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedColumn === col.name}
                            dragOverIndex={
                              dragOverColumn === col.name ? index : null
                            }
                            onSort={(direction) =>
                              handleSort(col.name, direction)
                            }
                            onFilter={(value) => handleFilter(col.name, value)}
                            onFilterByCondition={(condition, value) =>
                              handleFilterByCondition(
                                col.name,
                                condition,
                                value,
                              )
                            }
                            onClearFilter={() => handleClearFilter(col.name)}
                            hasActiveFilter={
                              !!columnFilters[col.name] ||
                              !!columnConditions[col.name] ||
                              sortConfig?.column === col.name
                            }
                            uniqueValues={getUniqueValues(col.name)}
                            onRename={(columnName) => {
                              const column = tableSchema?.columns.find(
                                (c) => c.name === columnName,
                              );
                              if (column) {
                                setEditingColumnData({
                                  name: column.name,
                                  type: column.type as
                                    | 'string'
                                    | 'number'
                                    | 'boolean'
                                    | 'date'
                                    | 'array'
                                    | 'object',
                                  required: column.required,
                                  default: String(column.default || ''),
                                  unique: (column as any).unique || false,
                                });
                                setShowEditColumnDialog(true);
                              }
                            }}
                            onDelete={(columnName) => {
                              setDeletingColumn(columnName);
                              setShowDeleteColumnDialog(true);
                            }}
                          />
                        ))}
                        <th className="border p-3 text-left border-t-0">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold text-neutral-700"
                          >
                            Criado em
                          </Typography>
                        </th>
                        <th className="border p-3 text-left border-t-0 border-r-0">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold text-neutral-700"
                          >
                            Atualizado em
                          </Typography>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="select-none">
                      {filteredAndSortedData.map((row, index) => {
                        const isSelected = selectedRows.some(
                          (r) => r.id === row._id,
                        );
                        return (
                          <tr
                            key={row._id}
                            className={`cursor-pointer ${
                              isSelected
                                ? 'bg-neutral-100 hover:bg-neutral-100'
                                : 'bg-white'
                            }`}
                            onClick={(e) => handleRowClick(e, index, row._id)}
                          >
                            <td className="border border-l-0 px-3">
                              <Typography
                                variant="span"
                                className="text-sm text-neutral-600"
                              >
                                {index + 1}
                              </Typography>
                            </td>
                            {tableSchema.columns.map((col) => (
                              <td
                                key={col.name}
                                className="border px-3 whitespace-nowrap"
                              >
                                {editingCell?.rowId === row._id &&
                                editingCell?.column === col.name ? (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setEditingValue(value);

                                        // Validar em tempo real
                                        const error = validateCellValue(
                                          value,
                                          col.type,
                                        );
                                        setValidationError(error);
                                      }}
                                      onBlur={() => {
                                        if (!validationError) {
                                          handleUpdateCell(
                                            row._id,
                                            col.name,
                                            editingValue,
                                            String(row[col.name] || ''),
                                          );
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === 'Enter' &&
                                          !validationError
                                        ) {
                                          handleUpdateCell(
                                            row._id,
                                            col.name,
                                            editingValue,
                                            String(row[col.name] || ''),
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
                                      handleEditCell(
                                        row._id,
                                        col.name,
                                        row[col.name],
                                      );
                                    }}
                                  >
                                    {(() => {
                                      const value = row[col.name];
                                      const isArrayColumn =
                                        col.type === 'array';
                                      const isObjectColumn =
                                        col.type === 'object';

                                      // Tentar fazer parse se for string e a coluna for do tipo array ou object
                                      let parsedValue = value;
                                      if (
                                        (isArrayColumn || isObjectColumn) &&
                                        typeof value === 'string' &&
                                        value.trim()
                                      ) {
                                        try {
                                          parsedValue = JSON.parse(value);
                                        } catch {
                                          // Se falhar o parse, manter o valor original
                                          parsedValue = value;
                                        }
                                      }

                                      if (Array.isArray(parsedValue)) {
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Typography
                                              variant="span"
                                              className="text-sm text-neutral-400 font-medium"
                                            >
                                              [Array com {parsedValue.length}{' '}
                                              item
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
                                      } else if (isArrayColumn) {
                                        // Coluna é do tipo array mas valor não é array
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Typography
                                              variant="span"
                                              className="text-sm text-neutral-400"
                                            >
                                              [Array vazio]
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
                                              [Objeto com {propCount}{' '}
                                              propriedade
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
                                      } else if (isObjectColumn) {
                                        // Coluna é do tipo object mas valor não é object
                                        return (
                                          <div className="flex items-center gap-2">
                                            <Typography
                                              variant="span"
                                              className="text-sm text-purple-400"
                                            >
                                              [Objeto vazio]
                                            </Typography>
                                            <Typography
                                              variant="span"
                                              className="text-sm text-neutral-400 italic"
                                            >
                                              Duplo clique para editar
                                            </Typography>
                                          </div>
                                        );
                                      } else if (String(value || '')) {
                                        return (
                                          <Typography
                                            variant="span"
                                            className="text-sm text-neutral-800"
                                          >
                                            {String(value)}
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
                            ))}
                            <td
                              className="border p-3 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Typography
                                variant="span"
                                className="text-sm text-neutral-500"
                              >
                                {new Date(row._createdAt).toLocaleString(
                                  'pt-BR',
                                )}
                              </Typography>
                            </td>
                            <td
                              className="border border-r-0 p-3 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Typography
                                variant="span"
                                className="text-sm text-neutral-500"
                              >
                                {new Date(row._updatedAt).toLocaleString(
                                  'pt-BR',
                                )}
                              </Typography>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Indicador de carregamento ao rolar */}
                      {loadingMore && (
                        <tr>
                          <td
                            colSpan={
                              tableSchema ? tableSchema.columns.length + 3 : 100
                            }
                            className="border p-4 text-center bg-neutral-50"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
                              <Typography
                                variant="span"
                                className="text-sm text-neutral-500"
                              >
                                Carregando mais registros... ({tableData.length}{' '}
                                /{' '}
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
                        tableData.length > 0 && (
                          <tr>
                            <td
                              colSpan={
                                tableSchema
                                  ? tableSchema.columns.length + 3
                                  : 100
                              }
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
                            colSpan={
                              tableSchema ? tableSchema.columns.length + 3 : 100
                            }
                            className="border p-12 text-center"
                          >
                            <Typography
                              variant="p"
                              className="text-neutral-500"
                            >
                              {Object.keys(columnFilters).length > 0 ||
                              Object.keys(columnConditions).length > 0
                                ? 'Nenhum registro corresponde aos filtros aplicados.'
                                : 'Nenhum dado encontrado. Adicione uma linha para começar.'}
                            </Typography>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* {selectedTable && (
                <div className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                  <Typography variant="span" className="text-sm">
                    💡 <strong>Dica:</strong> Duplo clique para editar célula.
                    Use{' '}
                    <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-sm">
                      Ctrl
                    </kbd>{' '}
                    para selecionar múltiplas linhas,{' '}
                    <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-sm">
                      Shift
                    </kbd>{' '}
                    para selecionar intervalo, e{' '}
                    <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-sm">
                      Delete
                    </kbd>{' '}
                    para apagar linhas selecionadas.
                  </Typography>
                </div>
              )} */}

              {!selectedTable && (
                <div className="flex-1 flex items-center justify-center">
                  <Typography
                    variant="p"
                    className="text-neutral-500 text-center"
                  >
                    Selecione uma tabela na barra lateral
                  </Typography>
                </div>
              )}
            </div>
          </div>
        </div>
      </Dialog>

      {/* Modal de aviso de mudanças não salvas */}
      <Dialog
        isOpen={showCloseWarning}
        onClose={handleCancelClose}
        closeButton={false}
        contentClassName="max-w-md h-fit"
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <Typography
              variant="h3"
              className="text-xl font-bold text-neutral-800"
            >
              ⚠️ Alterações não salvas
            </Typography>
            <Typography variant="p" className="text-neutral-600">
              Você tem alterações não salvas na tabela. Se você fechar agora,
              essas alterações serão perdidas.
            </Typography>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              onClick={handleCancelClose}
              variant="gradient"
              className="px-4"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmClose}
              variant="gradient"
              bgHexColor="#ef4444"
              className="px-4"
            >
              Sair sem salvar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal de criação de tabela */}
      <CreateTableDialog
        isOpen={showCreateTableDialog}
        onClose={() => setShowCreateTableDialog(false)}
        onSubmit={handleCreateTable}
      />

      {/* Modal de adição de colunas */}
      <AddColumnDialog
        isOpen={showAddColumnDialog}
        onClose={() => setShowAddColumnDialog(false)}
        onSubmit={handleAddColumns}
        tableName={selectedTable}
      />

      {/* Modal de edição de array */}
      {editingArrayData && (
        <EditArrayDialog
          isOpen={showEditArrayDialog}
          onClose={() => {
            setShowEditArrayDialog(false);
            setEditingArrayData(null);
          }}
          onSave={handleSaveArray}
          initialArray={editingArrayData.array}
          columnName={editingArrayData.column}
        />
      )}

      {editingObjectData && (
        <EditObjectDialog
          isOpen={showEditObjectDialog}
          onClose={() => {
            setShowEditObjectDialog(false);
            setEditingObjectData(null);
          }}
          onSave={handleSaveObject}
          initialObject={editingObjectData.object}
          columnName={editingObjectData.column}
        />
      )}

      {/* Modal de editar coluna */}
      {editingColumnData && (
        <EditColumnDialog
          isOpen={showEditColumnDialog}
          onClose={() => {
            setShowEditColumnDialog(false);
            setEditingColumnData(null);
          }}
          columnData={editingColumnData}
          onSubmit={handleEditColumn}
        />
      )}

      {/* Modal de excluir coluna */}
      <DeleteColumnDialog
        isOpen={showDeleteColumnDialog}
        onClose={() => {
          setShowDeleteColumnDialog(false);
          setDeletingColumn('');
        }}
        columnName={deletingColumn}
        onConfirm={handleDeleteColumn}
      />

      {/* Modal de renomear tabela */}
      <RenameTableDialog
        isOpen={showRenameTableDialog}
        onClose={() => {
          setShowRenameTableDialog(false);
          setRenamingTable('');
        }}
        tableName={renamingTable}
        onSubmit={handleRenameTable}
      />

      {/* Modal de excluir tabela */}
      <DeleteTableDialog
        isOpen={showDeleteTableDialog}
        onClose={() => {
          setShowDeleteTableDialog(false);
          setDeletingTable('');
        }}
        tableName={deletingTable}
        onConfirm={handleDeleteTable}
      />

      {/* Modal de Duplicatas */}
      <Dialog
        open={showDuplicatesDialog}
        onOpenChange={setShowDuplicatesDialog}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <Typography variant="h3" className="mb-4">
              Duplicatas Encontradas
            </Typography>

            {duplicatesData && (
              <>
                <Typography className="mb-4">
                  A coluna <strong>{duplicatesData.columnName}</strong> contém
                  valores duplicados. Para ativar o constraint UNIQUE, os
                  registros duplicados precisam ser removidos.
                </Typography>

                <div className="mb-4 p-4 bg-gray-50/40 rounded max-h-60 overflow-auto">
                  {duplicatesData.duplicates.map((dup, index) => (
                    <div
                      key={index}
                      className="mb-3 pb-3 border-b last:border-b-0"
                    >
                      <Typography className="font-semibold">
                        Valor: {String(dup.value)}
                      </Typography>
                      <Typography className="text-sm text-gray-600">
                        {dup.count} registros com este valor (será mantido
                        apenas 1, removendo {dup.count - 1})
                      </Typography>
                    </div>
                  ))}
                </div>

                <Typography className="mb-6 text-sm text-gray-600">
                  <strong>Total:</strong>{' '}
                  {duplicatesData.duplicates.reduce(
                    (sum, d) => sum + (d.count - 1),
                    0,
                  )}{' '}
                  registros serão removidos
                </Typography>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleCancelRemoveDuplicates}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveDuplicates}
                  >
                    Remover Duplicatas e Ativar UNIQUE
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
