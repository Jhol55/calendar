'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { ColumnFilter, type FilterCondition } from './column-filter';
import {
  getAvailableTables,
  getTableData,
  updateCell,
  addRow,
  deleteRow,
} from '@/actions/database/operations';

interface DatabaseSpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const spreadsheetSchema = z.object({
  selectedTable: z.string().optional(),
});

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
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    column: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
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
  }>({
    updates: [],
    additions: [],
    deletions: [],
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
      setPendingChanges({ updates: [], additions: [], deletions: [] });
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
      setPendingChanges({ updates: [], additions: [], deletions: [] });
      setHasUnsavedChanges(false);
      // Limpar filtros e ordenação
      setColumnFilters({});
      setColumnConditions({});
      setSortConfig(null);
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

  const loadTableData = async () => {
    try {
      setLoading(true);
      const response = await getTableData(selectedTable);
      if (response.success && response.data) {
        const tableResponse = response.data as {
          data: TableData[];
          schema: TableSchema | null;
        };
        setTableData(tableResponse.data || []);
        setTableSchema(tableResponse.schema || null);
      } else {
        console.error('Erro ao carregar dados:', response.message);
        setTableData([]);
        setTableSchema(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setTableData([]);
      setTableSchema(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCell = (rowId: string, column: string, value: string) => {
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
        }
      }

      // Processar todas as adições
      for (const addition of pendingChanges.additions) {
        const response = await addRow(selectedTable, addition);
        if (!response.success) {
          console.error('Erro ao adicionar linha:', response.message);
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
      setPendingChanges({ updates: [], additions: [], deletions: [] });
      setHasUnsavedChanges(false);

      // Recarregar dados da tabela para sincronizar
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
    setPendingChanges({ updates: [], additions: [], deletions: [] });
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

  const handleFormSubmit = () => {
    // Form não precisa submeter, apenas mantém o contexto
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={handleCloseDialog}
        closeButton={true}
        contentClassName="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] overflow-hidden flex flex-col p-6"
      >
        <Form
          className="flex flex-col gap-4 flex-1 overflow-hidden"
          style={{ zoom: 0.9 }}
          zodSchema={spreadsheetSchema}
          onSubmit={handleFormSubmit}
        >
          <div className="flex items-center gap-3">
            <Typography
              variant="h2"
              className="text-neutral-600 flex items-center gap-2"
            >
              🗄️ Banco de Dados
            </Typography>
            {hasUnsavedChanges && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">
                Alterações não salvas
              </Badge>
            )}
          </div>

          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Sidebar de tabelas */}
            <div className="w-64 border rounded-lg border-neutral-200 flex flex-col gap-2 overflow-y-auto bg-neutral-100 p-4">
              <Typography
                variant="h4"
                className="text-sm font-semibold text-neutral-700"
              >
                Tabelas
              </Typography>
              <Typography variant="p" className="text-sm text-neutral-700">
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
                  <Button
                    key={table}
                    variant="ghost"
                    onClick={() => setSelectedTable(table)}
                    className={`!text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedTable === table
                        ? 'bg-neutral-300 text-white font-medium'
                        : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
                    }`}
                  >
                    {table}
                  </Button>
                ))
              )}
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
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
                <Button
                  type="button"
                  onClick={loadTableData}
                  variant="gradient"
                  bgHexColor="#65b8f4"
                  disabled={!selectedTable || loading}
                  className="gap-2 w-fit whitespace-nowrap"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  Atualizar
                </Button>
                <Button
                  type="button"
                  onClick={handleAddRow}
                  variant="gradient"
                  disabled={!selectedTable || !tableSchema}
                  className="gap-2 w-fit whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
                {selectedRows.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleDeleteSelectedRows}
                    variant="gradient"
                    bgHexColor="#ef4444"
                    className="gap-2 w-fit"
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar {selectedRows.length}{' '}
                    {selectedRows.length === 1 ? 'linha' : 'linhas'}
                  </Button>
                )}
              </div>

              {selectedTable && (
                <div className="text-sm text-neutral-600 bg-gray-50 p-3 rounded-lg border border-neutral-200">
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
              )}

              {selectedTable && tableSchema && (
                <div className="flex-1 overflow-auto rounded-lg border-neutral-200 border">
                  <table className="w-full border-collapse">
                    <thead className="bg-neutral-100 sticky top-0 z-10">
                      <tr className="bg-neutral-100">
                        <th className="border-l-0 border-t-0 border p-3 text-left">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold text-neutral-700"
                          >
                            #
                          </Typography>
                        </th>
                        {tableSchema.columns.map((col) => (
                          <th
                            key={col.name}
                            className="border p-3 text-left border-t-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex gap-1">
                                <Typography
                                  variant="span"
                                  className="text-sm font-semibold text-neutral-700"
                                >
                                  {col.name}
                                </Typography>
                                <Typography
                                  variant="span"
                                  className="text-sm text-neutral-500 font-normal"
                                >
                                  ({col.type})
                                  {col.required && (
                                    <span className="text-red-500"> *</span>
                                  )}
                                </Typography>
                              </div>
                              <ColumnFilter
                                columnName={col.name}
                                onSort={(direction) =>
                                  handleSort(col.name, direction)
                                }
                                onFilter={(value) =>
                                  handleFilter(col.name, value)
                                }
                                onFilterByCondition={(condition, value) =>
                                  handleFilterByCondition(
                                    col.name,
                                    condition,
                                    value,
                                  )
                                }
                                onClearFilter={() =>
                                  handleClearFilter(col.name)
                                }
                                hasActiveFilter={
                                  !!columnFilters[col.name] ||
                                  !!columnConditions[col.name] ||
                                  sortConfig?.column === col.name
                                }
                                uniqueValues={getUniqueValues(col.name)}
                              />
                            </div>
                          </th>
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
                              <td key={col.name} className="border px-3">
                                {editingCell?.rowId === row._id &&
                                editingCell?.column === col.name ? (
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) =>
                                      setEditingValue(e.target.value)
                                    }
                                    onBlur={() => {
                                      handleUpdateCell(
                                        row._id,
                                        col.name,
                                        editingValue,
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateCell(
                                          row._id,
                                          col.name,
                                          editingValue,
                                        );
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="!text-sm w-full rounded-md border border-gray-300 bg-white p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d]"
                                  />
                                ) : (
                                  <div
                                    className="cursor-pointer hover:bg-transparent p-1.5 rounded min-h-[28px] transition-colors"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCell({
                                        rowId: row._id,
                                        column: col.name,
                                      });
                                      setEditingValue(
                                        String(row[col.name] || ''),
                                      );
                                    }}
                                  >
                                    {String(row[col.name] || '') ? (
                                      <Typography
                                        variant="span"
                                        className="text-sm text-neutral-800"
                                      >
                                        {String(row[col.name])}
                                      </Typography>
                                    ) : (
                                      <Typography
                                        variant="span"
                                        className="text-sm text-neutral-400 italic"
                                      >
                                        Duplo clique para editar
                                      </Typography>
                                    )}
                                  </div>
                                )}
                              </td>
                            ))}
                            <td
                              className="border p-3"
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
                              className="border border-r-0 p-3"
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
                    </tbody>
                  </table>

                  {filteredAndSortedData.length === 0 && (
                    <div className="text-center py-12">
                      <Typography variant="p" className="text-neutral-500">
                        {Object.keys(columnFilters).length > 0 ||
                        Object.keys(columnConditions).length > 0
                          ? 'Nenhum registro corresponde aos filtros aplicados.'
                          : 'Nenhum dado encontrado. Adicione uma linha para começar.'}
                      </Typography>
                    </div>
                  )}
                </div>
              )}

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
        </Form>
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
              ⚠️ Mudanças não salvas
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
    </>
  );
}
