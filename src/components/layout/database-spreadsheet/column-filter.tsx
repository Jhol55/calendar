'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X, ArrowLeft } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

export type FilterCondition =
  | 'none'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'equals';

interface ColumnFilterProps {
  columnName: string;
  onSort?: (direction: 'asc' | 'desc') => void;
  onFilter?: (value: string) => void;
  onFilterByCondition?: (condition: FilterCondition, value?: string) => void;
  onClearFilter?: () => void;
  hasActiveFilter?: boolean;
  uniqueValues?: string[];
}

export function ColumnFilter({
  columnName: _columnName, // eslint-disable-line @typescript-eslint/no-unused-vars
  onSort,
  onFilter,
  onFilterByCondition,
  onClearFilter,
  hasActiveFilter = false,
  uniqueValues = [],
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showValueFilter, setShowValueFilter] = useState(false);
  const [showConditionFilter, setShowConditionFilter] = useState(false);
  const [selectedCondition, setSelectedCondition] =
    useState<FilterCondition | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionValue, setConditionValue] = useState('');

  const filteredValues = uniqueValues.filter((value) =>
    String(value).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSort = (direction: 'asc' | 'desc') => {
    onSort?.(direction);
    setIsOpen(false);
  };

  const handleFilterValue = (value: string) => {
    onFilter?.(value);
    setIsOpen(false);
    setShowValueFilter(false);
  };

  const handleClearFilter = () => {
    onClearFilter?.();
    setIsOpen(false);
    setShowValueFilter(false);
    setShowConditionFilter(false);
    setSelectedCondition(null);
    setSearchTerm('');
    setConditionValue('');
  };

  const handleConditionSelect = (condition: FilterCondition) => {
    if (condition === 'none') {
      handleClearFilter();
    } else if (condition === 'isEmpty' || condition === 'isNotEmpty') {
      // Apply immediately for conditions that don't need a value
      onFilterByCondition?.(condition);
      setIsOpen(false);
      setShowConditionFilter(false);
      setSelectedCondition(null);
    } else {
      // Show input for conditions that need a value
      setSelectedCondition(condition);
      setConditionValue('');
    }
  };

  const handleApplyConditionWithValue = () => {
    if (selectedCondition && conditionValue.trim()) {
      onFilterByCondition?.(selectedCondition, conditionValue);
      setIsOpen(false);
      setShowConditionFilter(false);
      setSelectedCondition(null);
      setConditionValue('');
    }
  };

  const handleBackFromInput = () => {
    setSelectedCondition(null);
    setConditionValue('');
  };

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={`!p-1 !h-auto hover:bg-neutral-200 rounded transition-colors ${
          hasActiveFilter ? 'text-emerald-400' : 'text-neutral-500'
        }`}
      >
        <Filter className="w-3.5 h-3.5" />
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setIsOpen(false);
              setShowValueFilter(false);
              setShowConditionFilter(false);
            }}
          />

          {/* Menu principal */}
          {!showValueFilter && !showConditionFilter ? (
            <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[200px] py-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleSort('asc')}
                className="!w-full !justify-start px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center gap-2 rounded-none"
              >
                <ChevronUp className="w-4 h-4 text-neutral-600" />
                <Typography variant="span" className="text-sm">
                  Classificar A a Z
                </Typography>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => handleSort('desc')}
                className="!w-full !justify-start px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center gap-2 rounded-none"
              >
                <ChevronDown className="w-4 h-4 text-neutral-600" />
                <Typography variant="span" className="text-sm">
                  Classificar Z a A
                </Typography>
              </Button>

              <div className="border-t border-neutral-200 my-2" />

              <div className="flex justify-center items-center flex-col w-full">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConditionFilter(true)}
                  className="relative !w-full !justify-between px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center rounded-none"
                >
                  <Typography variant="span" className="text-sm">
                    Filtrar por condição
                  </Typography>
                  <ChevronDown className="absolute right-0 w-4 h-4 rotate-[-90deg] text-neutral-600" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowValueFilter(true)}
                  className="relative !w-full !justify-between px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center rounded-none"
                >
                  <Typography variant="span" className="text-sm">
                    Filtrar por valores
                  </Typography>
                  <ChevronDown className="absolute right-0 w-4 h-4 rotate-[-90deg] text-neutral-600" />
                </Button>
              </div>

              {hasActiveFilter && (
                <>
                  <div className="border-t border-neutral-200 my-2" />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClearFilter}
                    className="!w-full !justify-start px-4 py-2 !text-left text-sm hover:bg-neutral-100 flex items-center gap-2 text-red-600 rounded-none"
                  >
                    <X className="w-4 h-4" />
                    <Typography variant="span" className="text-sm text-red-600">
                      Limpar filtro
                    </Typography>
                  </Button>
                </>
              )}
            </div>
          ) : showConditionFilter ? (
            /* Menu de filtro por condição */
            <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[200px] w-fit py-2">
              <div className="px-3 pb-2 border-b border-neutral-200 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (selectedCondition) {
                      handleBackFromInput();
                    } else {
                      setShowConditionFilter(false);
                    }
                  }}
                  className="!w-fit !h-auto !p-1 text-sm text-neutral-600 hover:text-neutral-800 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <Typography variant="span" className="text-sm">
                    Voltar
                  </Typography>
                </Button>
              </div>

              {!selectedCondition ? (
                /* Lista de condições */
                <div className="flex flex-col py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('none')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      Nenhum
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('isEmpty')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      Está vazio
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('isNotEmpty')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      Não está vazio
                    </Typography>
                  </Button>

                  <div className="border-t border-neutral-200 my-2" />

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('contains')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      O texto contém
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('notContains')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      O texto não contém
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('startsWith')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      O texto começa com
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('endsWith')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      O texto termina com
                    </Typography>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleConditionSelect('equals')}
                    className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                  >
                    <Typography variant="span" className="text-sm">
                      O texto é exatamente
                    </Typography>
                  </Button>
                </div>
              ) : (
                /* Input para valor da condição */
                <div className="px-4 py-3">
                  <Typography
                    variant="span"
                    className="text-sm block mb-2 font-medium"
                  >
                    {selectedCondition === 'contains' && 'O texto contém'}
                    {selectedCondition === 'notContains' &&
                      'O texto não contém'}
                    {selectedCondition === 'startsWith' && 'O texto começa com'}
                    {selectedCondition === 'endsWith' && 'O texto termina com'}
                    {selectedCondition === 'equals' && 'O texto é exatamente'}
                  </Typography>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Valor"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleApplyConditionWithValue();
                        }
                      }}
                      className="flex-1 px-2 py-1.5 border border-neutral-300 rounded-md text-sm font-light outline-none focus:ring-2 focus:ring-[#5c5e5d]"
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="gradient"
                      onClick={handleApplyConditionWithValue}
                      disabled={!conditionValue.trim()}
                      className="!px-3 !py-1.5 !h-auto text-xs"
                    >
                      OK
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : showValueFilter ? (
            /* Menu de filtro por valores */
            <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-neutral-200 rounded-lg shadow-lg w-[250px] py-2">
              <div className="px-3 pb-2 border-b border-neutral-200 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowValueFilter(false)}
                  className="!w-fit !h-auto !p-1 text-sm text-neutral-600 hover:text-neutral-800 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <Typography variant="span" className="text-sm">
                    Voltar
                  </Typography>
                </Button>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border text-neutral-600 border-neutral-300 font-light rounded-md text-sm outline-none focus:ring-2 focus:ring-[#5c5e5d]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="max-h-[200px] overflow-y-auto">
                <Typography
                  variant="p"
                  className="px-4 py-2 text-xs text-neutral-500"
                >
                  Mostrando {filteredValues.length}
                </Typography>

                {filteredValues.length === 0 ? (
                  <Typography
                    variant="p"
                    className="px-4 py-2 text-sm text-neutral-500"
                  >
                    Nenhum valor encontrado
                  </Typography>
                ) : (
                  filteredValues.map((value, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      onClick={() => handleFilterValue(String(value))}
                      className="!w-full !justify-start px-4 py-2 !text-left hover:bg-neutral-100 rounded-none"
                    >
                      <Typography variant="span" className="text-sm">
                        {String(value) || '(Vazio)'}
                      </Typography>
                    </Button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
