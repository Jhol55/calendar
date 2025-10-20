'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormSelect } from '@/components/ui/select';
import { FormControl } from '@/components/ui/form-control';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { z } from 'zod';
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

  // Carregar tabelas disponíveis
  useEffect(() => {
    if (isOpen) {
      loadAvailableTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleUpdateCell = async (
    rowId: string,
    column: string,
    value: string,
  ) => {
    try {
      const response = await updateCell(selectedTable, rowId, column, value);

      if (response.success) {
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
        setEditingCell(null);
      } else {
        console.error('Erro ao atualizar célula:', response.message);
      }
    } catch (error) {
      console.error('Erro ao atualizar célula:', error);
    }
  };

  const handleAddRow = async () => {
    if (!tableSchema) return;

    const newRow: Record<string, unknown> = {
      _id: crypto.randomUUID(),
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
    };

    tableSchema.columns.forEach((col) => {
      newRow[col.name] = col.default || '';
    });

    try {
      const response = await addRow(selectedTable, newRow);

      if (response.success) {
        setTableData((prev) => [...prev, newRow as TableData]);
      } else {
        console.error('Erro ao adicionar linha:', response.message);
      }
    } catch (error) {
      console.error('Erro ao adicionar linha:', error);
    }
  };

  const handleDeleteSelectedRows = async () => {
    try {
      for (const selectedRow of selectedRows) {
        const response = await deleteRow(selectedTable, selectedRow.id);
        if (!response.success) {
          console.error('Erro ao deletar linha:', response.message);
        }
      }

      const selectedIds = selectedRows.map((row) => row.id);
      setTableData((prev) =>
        prev.filter((row) => !selectedIds.includes(row._id)),
      );
      setSelectedRows([]);
    } catch (error) {
      console.error('Erro ao deletar linhas selecionadas:', error);
    }
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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] overflow-hidden flex flex-col p-6"
    >
      <Form
        className="flex flex-col gap-4 flex-1 overflow-hidden"
        zodSchema={spreadsheetSchema}
        onSubmit={handleFormSubmit}
      >
        <div className="mb-4">
          <Typography
            variant="h3"
            className="text-2xl font-bold text-neutral-800"
          >
            📊 Visualizador de Banco de Dados
          </Typography>
        </div>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden p-1">
          <div className="flex gap-4 items-end justify-between">
            <div className="flex flex-col gap-2 w-72">
              <FormControl variant="label" htmlFor="selectedTable">
                Selecione a Tabela
              </FormControl>
              <FormSelect
                fieldName="selectedTable"
                placeholder="Escolha uma tabela"
                options={availableTables.map((table) => ({
                  value: table,
                  label: table,
                }))}
                onValueChange={setSelectedTable}
                className="w-full"
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                onClick={loadTableData}
                variant="gradient"
                bgHexColor="#5fec3c"
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
          </div>

          {selectedTable && (
            <div className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <Typography variant="span" className="text-xs">
                💡 <strong>Dica:</strong> Duplo clique para editar célula. Use{' '}
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-xs">
                  Ctrl
                </kbd>{' '}
                para selecionar múltiplas linhas,{' '}
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-xs">
                  Shift
                </kbd>{' '}
                para selecionar intervalo, e{' '}
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-300 rounded shadow-sm font-mono text-xs">
                  Delete
                </kbd>{' '}
                para apagar linhas selecionadas.
              </Typography>
            </div>
          )}

          {selectedTable && tableSchema && (
            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full border-collapse">
                <thead className="bg-neutral-100 sticky top-0 z-10">
                  <tr>
                    <th className="border p-3 text-left">
                      <Typography
                        variant="span"
                        className="text-sm font-semibold text-neutral-700"
                      >
                        #
                      </Typography>
                    </th>
                    {tableSchema.columns.map((col) => (
                      <th key={col.name} className="border p-3 text-left">
                        <div className="flex flex-col gap-1">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold text-neutral-700"
                          >
                            {col.name}
                          </Typography>
                          <Typography
                            variant="span"
                            className="text-xs text-neutral-500 font-normal"
                          >
                            ({col.type})
                            {col.required && (
                              <span className="text-red-500"> *</span>
                            )}
                          </Typography>
                        </div>
                      </th>
                    ))}
                    <th className="border p-3 text-left">
                      <Typography
                        variant="span"
                        className="text-sm font-semibold text-neutral-700"
                      >
                        Criado em
                      </Typography>
                    </th>
                    <th className="border p-3 text-left">
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
                  {tableData.map((row, index) => {
                    const isSelected = selectedRows.some(
                      (r) => r.id === row._id,
                    );
                    return (
                      <tr
                        key={row._id}
                        className={`cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-100 hover:bg-neutral-100'
                            : 'hover:bg-neutral-50'
                        }`}
                        onClick={(e) => handleRowClick(e, index, row._id)}
                      >
                        <td className="border p-3">
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-600"
                          >
                            {index + 1}
                          </Typography>
                        </td>
                        {tableSchema.columns.map((col) => (
                          <td key={col.name} className="border p-3">
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
                                className="w-full px-2 py-1.5 border border-neutral-400 rounded-md outline-none focus:ring-2 focus:ring-neutral-500 bg-white text-sm"
                              />
                            ) : (
                              <div
                                className="cursor-pointer hover:bg-neutral-50 p-1.5 rounded min-h-[28px] transition-colors"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCell({
                                    rowId: row._id,
                                    column: col.name,
                                  });
                                  setEditingValue(String(row[col.name] || ''));
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
                                    className="text-xs text-neutral-400 italic"
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
                            className="text-xs text-neutral-500"
                          >
                            {new Date(row._createdAt).toLocaleString('pt-BR')}
                          </Typography>
                        </td>
                        <td
                          className="border p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Typography
                            variant="span"
                            className="text-xs text-neutral-500"
                          >
                            {new Date(row._updatedAt).toLocaleString('pt-BR')}
                          </Typography>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {tableData.length === 0 && (
                <div className="text-center py-12">
                  <Typography variant="p" className="text-neutral-500">
                    Nenhum dado encontrado. Adicione uma linha para começar.
                  </Typography>
                </div>
              )}
            </div>
          )}

          {!selectedTable && (
            <div className="flex-1 flex items-center justify-center">
              <Typography variant="p" className="text-neutral-500 text-center">
                Selecione uma tabela para visualizar os dados
              </Typography>
            </div>
          )}
        </div>
      </Form>
    </Dialog>
  );
}
