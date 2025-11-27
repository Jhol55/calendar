'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyValueSpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Record<string, unknown> | Array<Record<string, unknown>>,
  ) => void;
  initialData: Record<string, unknown> | Array<Record<string, unknown>>;
  isArray?: boolean; // Se true, trata como array de objetos; se false, trata como objeto único
}

interface KeyValueRow {
  id: string;
  chave: string;
  valor: unknown;
}

export function KeyValueSpreadsheet({
  isOpen,
  onClose,
  onSave,
  initialData,
  isArray = false,
}: KeyValueSpreadsheetProps) {
  const [rows, setRows] = useState<KeyValueRow[]>([]);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    column: 'chave' | 'valor';
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Inicializar dados quando o dialog abrir
  useEffect(() => {
    if (isOpen) {
      let dataArray: KeyValueRow[] = [];

      if (isArray && Array.isArray(initialData)) {
        // Se for array de objetos, cada objeto vira uma linha
        // Assumindo que cada objeto tem propriedades "chave" e "valor"
        dataArray = initialData.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // Se o objeto tem propriedades "chave" e "valor", usar essas
            const obj = item as Record<string, unknown>;
            return {
              id: `row-${index}`,
              chave: String(obj.chave || obj.key || ''),
              valor:
                obj.valor !== undefined
                  ? obj.valor
                  : obj.value !== undefined
                    ? obj.value
                    : '',
            };
          } else {
            // Se não for objeto, usar o índice como chave
            return {
              id: `row-${index}`,
              chave: String(index),
              valor: item,
            };
          }
        });
      } else {
        // Converter objeto para array de pares chave-valor
        const obj = (initialData as Record<string, unknown>) || {};
        dataArray = Object.entries(obj).map(([key, value], index) => ({
          id: `row-${index}`,
          chave: key,
          valor: value,
        }));
      }

      // Se estiver vazio, adicionar uma linha vazia
      if (dataArray.length === 0) {
        dataArray.push({
          id: `row-${Date.now()}`,
          chave: '',
          valor: '',
        });
      }

      setRows(dataArray);
      setSelectedRows([]);
      setEditingCell(null);
      setHasChanges(false);
    }
  }, [isOpen, initialData, isArray]);

  const handleAddRow = () => {
    const newRow: KeyValueRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chave: '',
      valor: '',
    };
    setRows((prev) => [...prev, newRow]);
    setHasChanges(true);
  };

  const handleDeleteSelectedRows = () => {
    if (selectedRows.length === 0) return;
    setRows((prev) => prev.filter((row) => !selectedRows.includes(row.id)));
    setSelectedRows([]);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (isArray) {
      // Se for array, converter cada linha em um objeto com "chave" e "valor"
      const result: Array<Record<string, unknown>> = rows
        .filter((row) => row.chave.trim() || row.valor !== '')
        .map((row) => {
          // Tentar preservar o tipo original do valor
          let value: unknown = row.valor;

          // Se for string, tentar parsear como JSON ou converter tipos primitivos
          if (typeof value === 'string' && value.trim()) {
            const stringValue = value;
            // Tentar parsear como JSON primeiro
            try {
              value = JSON.parse(stringValue);
            } catch {
              // Se não for JSON válido, tentar converter para número ou booleano
              // Verificar se é número
              if (!isNaN(Number(stringValue)) && stringValue.trim() !== '') {
                value = Number(stringValue);
              }
              // Verificar se é booleano
              else if (
                stringValue.toLowerCase() === 'true' ||
                stringValue.toLowerCase() === 'false'
              ) {
                value = stringValue.toLowerCase() === 'true';
              }
              // Caso contrário, manter como string
            }
          }

          return {
            chave: row.chave.trim(),
            valor: value,
          };
        });
      onSave(result);
    } else {
      // Converter array de linhas de volta para objeto
      const result: Record<string, unknown> = {};
      rows.forEach((row) => {
        if (row.chave.trim()) {
          // Tentar preservar o tipo original do valor
          let value: unknown = row.valor;

          // Se for string, tentar parsear como JSON ou converter tipos primitivos
          if (typeof value === 'string' && value.trim()) {
            const stringValue = value;
            // Tentar parsear como JSON primeiro
            try {
              value = JSON.parse(stringValue);
            } catch {
              // Se não for JSON válido, tentar converter para número ou booleano
              // Verificar se é número
              if (!isNaN(Number(stringValue)) && stringValue.trim() !== '') {
                value = Number(stringValue);
              }
              // Verificar se é booleano
              else if (
                stringValue.toLowerCase() === 'true' ||
                stringValue.toLowerCase() === 'false'
              ) {
                value = stringValue.toLowerCase() === 'true';
              }
              // Caso contrário, manter como string
            }
          }

          result[row.chave.trim()] = value;
        }
      });
      onSave(result);
    }
    setHasChanges(false);
  };

  const handleUpdateCell = (
    rowId: string,
    column: 'chave' | 'valor',
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          // Para a coluna valor, manter como string temporariamente (será convertido no save)
          // Para a coluna chave, sempre string
          return { ...row, [column]: value };
        }
        return row;
      }),
    );
    setEditingCell(null);
    setEditingValue('');
    setHasChanges(true);
  };

  const handleEditCell = (
    rowId: string,
    column: 'chave' | 'valor',
    currentValue: unknown,
  ) => {
    setEditingCell({ rowId, column });
    // Para valores complexos (objeto/array), mostrar como JSON stringificado
    let displayValue = '';
    if (currentValue === null || currentValue === undefined) {
      displayValue = '';
    } else if (typeof currentValue === 'object') {
      displayValue = JSON.stringify(currentValue, null, 2);
    } else {
      displayValue = String(currentValue);
    }
    setEditingValue(displayValue);
  };

  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    rowId: string,
  ) => {
    if (editingCell?.rowId === rowId) return;

    if (e.ctrlKey || e.metaKey) {
      // Seleção múltipla
      setSelectedRows((prev) =>
        prev.includes(rowId)
          ? prev.filter((id) => id !== rowId)
          : [...prev, rowId],
      );
    } else if (e.shiftKey && selectedRows.length > 0) {
      // Seleção por intervalo
      const currentIndex = rows.findIndex((r) => r.id === rowId);
      const lastSelectedIndex = rows.findIndex(
        (r) => r.id === selectedRows[selectedRows.length - 1],
      );
      const start = Math.min(currentIndex, lastSelectedIndex);
      const end = Math.max(currentIndex, lastSelectedIndex);
      const idsToSelect = rows
        .slice(start, end + 1)
        .map((r) => r.id)
        .filter((id) => !selectedRows.includes(id));
      setSelectedRows((prev) => [...prev, ...idsToSelect]);
    } else {
      // Seleção simples
      setSelectedRows([rowId]);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col p-6"
    >
      <div
        className="flex flex-col gap-4 flex-1 overflow-hidden"
        style={{ zoom: 0.9 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Typography variant="h2" className="text-neutral-800">
              Editar Valor
            </Typography>
            <Typography variant="p" className="text-neutral-600 text-sm mt-1">
              Edite os pares chave-valor
            </Typography>
          </div>
          <div className="flex gap-4 items-center" style={{ zoom: 0.9 }}>
            {hasChanges && (
              <Button
                type="button"
                onClick={handleSave}
                variant="gradient"
                className="gap-2 w-fit whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                Salvar
              </Button>
            )}
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
                bgHexColor="#ef4444"
                className="gap-2 w-fit whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedRows.length})
              </Button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto border rounded-lg border-neutral-200">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-100 sticky top-0 z-10">
              <tr>
                <th className="border border-l-0 px-3 py-2 text-left w-16">
                  <Typography
                    variant="span"
                    className="text-sm font-semibold text-neutral-700"
                  >
                    #
                  </Typography>
                </th>
                <th className="border px-3 py-2 text-left">
                  <Typography
                    variant="span"
                    className="text-sm font-semibold text-neutral-700"
                  >
                    Chave
                  </Typography>
                </th>
                <th className="border border-r-0 px-3 py-2 text-left">
                  <Typography
                    variant="span"
                    className="text-sm font-semibold text-neutral-700"
                  >
                    Valor
                  </Typography>
                </th>
              </tr>
            </thead>
            <tbody className="select-none">
              {rows.map((row, index) => {
                const isSelected = selectedRows.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer transition-colors duration-300',
                      isSelected
                        ? 'bg-neutral-100 hover:bg-neutral-100'
                        : 'bg-white',
                    )}
                    onClick={(e) => handleRowClick(e, row.id)}
                  >
                    <td className="border border-l-0 px-3">
                      <Typography
                        variant="span"
                        className="text-sm text-neutral-600"
                      >
                        {index + 1}
                      </Typography>
                    </td>
                    <td className="border px-3 whitespace-nowrap">
                      {editingCell?.rowId === row.id &&
                      editingCell?.column === 'chave' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => {
                            handleUpdateCell(row.id, 'chave', editingValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateCell(row.id, 'chave', editingValue);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                              setEditingValue('');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="!text-sm w-full rounded-md border p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 border-gray-300 bg-white focus:ring-[#5c5e5d]"
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-transparent p-1.5 rounded min-h-[28px] transition-colors"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleEditCell(row.id, 'chave', row.chave);
                          }}
                        >
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-800"
                          >
                            {String(row.chave || '') || (
                              <span className="text-neutral-400 italic">
                                Duplo clique para editar
                              </span>
                            )}
                          </Typography>
                        </div>
                      )}
                    </td>
                    <td className="border border-r-0 px-3 whitespace-nowrap">
                      {editingCell?.rowId === row.id &&
                      editingCell?.column === 'valor' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => {
                            handleUpdateCell(row.id, 'valor', editingValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateCell(row.id, 'valor', editingValue);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                              setEditingValue('');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="!text-sm w-full rounded-md border p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 border-gray-300 bg-white focus:ring-[#5c5e5d]"
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-transparent p-1.5 rounded min-h-[28px] transition-colors"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleEditCell(row.id, 'valor', row.valor);
                          }}
                        >
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-800"
                          >
                            {(() => {
                              const val = row.valor;
                              if (
                                val === null ||
                                val === undefined ||
                                val === ''
                              ) {
                                return (
                                  <span className="text-neutral-400 italic">
                                    Duplo clique para editar
                                  </span>
                                );
                              }
                              // Se for objeto ou array, mostrar como JSON
                              if (typeof val === 'object') {
                                return JSON.stringify(val);
                              }
                              // Caso contrário, mostrar como string
                              return String(val);
                            })()}
                          </Typography>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
