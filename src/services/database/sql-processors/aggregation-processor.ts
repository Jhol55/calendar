// ============================================
// AGGREGATION PROCESSOR - GROUP BY & Aggregate Functions
// ============================================

import type { AggregateFunction } from '../sql-types';
import { FilterTranslator } from './filter-translator';
import type { FilterConfig } from '../database.types';

export class AggregationProcessor {
  private filterTranslator = new FilterTranslator();
  /**
   * Processa agregações em um conjunto de registros
   */
  aggregate(
    records: Record<string, unknown>[],
    groupByFields: string[],
    aggregations: AggregateFunction[],
  ): Record<string, unknown>[] {
    if (groupByFields.length === 0) {
      // Sem GROUP BY: agregar todos os registros em um único resultado
      return [this.applyAggregations([records], aggregations)[0]];
    }

    // Com GROUP BY: agrupar e agregar cada grupo
    const groups = this.groupRecords(records, groupByFields);
    return this.applyAggregations(
      Array.from(groups.values()),
      aggregations,
      groupByFields,
    );
  }

  /**
   * Agrupa registros pelos campos especificados
   */
  private groupRecords(
    records: Record<string, unknown>[],
    fields: string[],
  ): Map<string, Record<string, unknown>[]> {
    const groups = new Map<string, Record<string, unknown>[]>();

    for (const record of records) {
      // Criar chave do grupo concatenando valores dos campos
      const groupKey = fields
        .map((field) => {
          const value = record[field];
          return value === null || value === undefined
            ? '__NULL__'
            : String(value);
        })
        .join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(record);
    }

    console.log(
      `📊 Grouped ${records.length} records into ${groups.size} groups`,
    );
    return groups;
  }

  /**
   * Aplica agregações em cada grupo
   */
  private applyAggregations(
    groups: Record<string, unknown>[][],
    aggregations: AggregateFunction[],
    groupByFields: string[] = [],
  ): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];

    for (const group of groups) {
      // Se o grupo está vazio mas temos agregações, ainda precisamos retornar um resultado
      // (por exemplo, SELECT COUNT(*) de uma tabela vazia deve retornar 0, não vazio)
      if (group.length === 0 && groupByFields.length > 0) {
        // Com GROUP BY, pular grupos vazios
        continue;
      }

      const result: Record<string, unknown> = {};

      // Incluir campos do GROUP BY (usar valores do primeiro registro)
      for (const field of groupByFields) {
        // Se grupo vazio, não há valores para incluir
        if (group.length > 0) {
          result[field] = group[0][field];
        }
      }

      // Aplicar cada agregação
      for (const agg of aggregations) {
        const aggValue = this.executeAggregateFunction(group, agg);
        const defaultKey = `${agg.function}(${agg.field || '*'})`;

        // Sempre criar com nome padrão (para HAVING funcionar)
        result[defaultKey] = aggValue;

        // Se houver alias diferente, criar também com o alias
        if (agg.alias && agg.alias !== defaultKey) {
          result[agg.alias] = aggValue;
        }
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Executa uma função de agregação em um grupo
   */
  private executeAggregateFunction(
    records: Record<string, unknown>[],
    agg: AggregateFunction,
  ): number | string | unknown[] | Record<string, unknown> | null {
    switch (agg.function) {
      case 'COUNT':
        return this.count(records, agg.field, agg.distinct);
      case 'SUM':
        return this.sum(records, agg.field!);
      case 'AVG':
        return this.avg(records, agg.field!);
      case 'MIN':
        return this.min(records, agg.field!);
      case 'MAX':
        return this.max(records, agg.field!);
      case 'STRING_AGG':
      case 'GROUP_CONCAT':
        return this.stringAgg(records, agg.field!, agg.separator || ',');
      case 'ARRAY_AGG':
        return this.arrayAgg(records, agg.field!);
      case 'JSON_AGG':
        return this.jsonAgg(records, agg.field);
      case 'JSON_OBJECT_AGG':
        return this.jsonObjectAgg(records, agg.field!, agg.valueField!);
      default:
        throw new Error(`Unsupported aggregate function: ${agg.function}`);
    }
  }

  /**
   * COUNT - conta registros (ou valores distintos)
   */
  private count(
    records: Record<string, unknown>[],
    field?: string,
    distinct?: boolean,
  ): number {
    if (!field || field === '*') {
      // COUNT(*) - conta todos os registros
      return records.length;
    }

    // COUNT(field) - conta valores não-null
    const values = records
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined);

    if (distinct) {
      // COUNT(DISTINCT field) - conta valores únicos
      return new Set(values).size;
    }

    return values.length;
  }

  /**
   * SUM - soma valores numéricos
   */
  private sum(records: Record<string, unknown>[], field: string): number {
    let sum = 0;

    for (const record of records) {
      const value = record[field];
      if (typeof value === 'number') {
        sum += value;
      } else if (typeof value === 'string') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          sum += numValue;
        }
      }
    }

    return sum;
  }

  /**
   * AVG - média de valores numéricos
   */
  private avg(
    records: Record<string, unknown>[],
    field: string,
  ): number | null {
    const values = records
      .map((r) => {
        const value = r[field];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const numValue = parseFloat(value);
          return isNaN(numValue) ? null : numValue;
        }
        return null;
      })
      .filter((v) => v !== null) as number[];

    if (values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * MIN - valor mínimo
   */
  private min(
    records: Record<string, unknown>[],
    field: string,
  ): number | string | null {
    const values = records
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) return null;

    return Math.min(
      ...values.map((v) => (typeof v === 'number' ? v : parseFloat(String(v)))),
    );
  }

  /**
   * MAX - valor máximo
   */
  private max(
    records: Record<string, unknown>[],
    field: string,
  ): number | string | null {
    const values = records
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) return null;

    return Math.max(
      ...values.map((v) => (typeof v === 'number' ? v : parseFloat(String(v)))),
    );
  }

  /**
   * STRING_AGG / GROUP_CONCAT - Concatena strings com separador
   */
  private stringAgg(
    records: Record<string, unknown>[],
    field: string,
    separator: string,
  ): string {
    const values = records
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v));

    return values.join(separator);
  }

  /**
   * ARRAY_AGG - Agrupa valores em array
   */
  private arrayAgg(
    records: Record<string, unknown>[],
    field: string,
  ): unknown[] {
    return records
      .map((r) => r[field])
      .filter((v) => v !== null && v !== undefined);
  }

  /**
   * JSON_AGG - Agrupa rows como array de objetos JSON
   */
  private jsonAgg(
    records: Record<string, unknown>[],
    field?: string,
  ): unknown[] {
    if (field) {
      // Se especificou um campo, retornar array dos valores desse campo
      return records.map((r) => r[field]);
    }
    // Sem campo específico, retornar array de objetos (rows completas)
    return records.map((r) => {
      // Remover campos internos (_id, etc)
      const obj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        if (!key.startsWith('_')) {
          obj[key] = value;
        }
      }
      return obj;
    });
  }

  /**
   * JSON_OBJECT_AGG - Agrupa key-value pairs em objeto JSON
   */
  private jsonObjectAgg(
    records: Record<string, unknown>[],
    keyField: string,
    valueField: string,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const record of records) {
      const key = record[keyField];
      const value = record[valueField];
      if (key !== null && key !== undefined) {
        result[String(key)] = value;
      }
    }
    return result;
  }

  /**
   * Aplica cláusula HAVING (filtra grupos após agregação)
   */
  applyHaving(
    aggregatedRecords: Record<string, unknown>[],
    havingCondition: unknown,
  ): Record<string, unknown>[] {
    if (!havingCondition) {
      return aggregatedRecords;
    }

    // Converter condição HAVING em FilterConfig usando FilterTranslator
    const filterConfig =
      this.filterTranslator.translateToFilterConfig(havingCondition);

    // Aplicar filtros nos registros agregados
    return aggregatedRecords.filter((record) => {
      return this.matchesFilter(record, filterConfig);
    });
  }

  /**
   * Verifica se um registro match um filtro (similar ao DatabaseService.matchesFilters)
   */
  private matchesFilter(
    record: Record<string, unknown>,
    filter: FilterConfig,
  ): boolean {
    if (!filter.rules || filter.rules.length === 0) return true;

    const results = filter.rules.map((rule) => {
      // Se a regra é aninhada (tem condition e rules), processar recursivamente
      if ('condition' in rule && 'rules' in rule) {
        return this.matchesFilter(record, rule);
      }

      // Caso contrário, é uma regra simples (FilterRule)
      const value = record[rule.field];
      const compareValue = rule.value;

      switch (rule.operator) {
        case 'equals':
          return value == compareValue;
        case 'notEquals':
          return value != compareValue;
        case 'greaterThan':
          return Number(value) > Number(compareValue);
        case 'lessThan':
          return Number(value) < Number(compareValue);
        case 'greaterThanOrEqual':
          return Number(value) >= Number(compareValue);
        case 'lessThanOrEqual':
          return Number(value) <= Number(compareValue);
        case 'contains':
          return String(value).includes(String(compareValue));
        case 'notContains':
          return !String(value).includes(String(compareValue));
        case 'startsWith':
          return String(value).startsWith(String(compareValue));
        case 'endsWith':
          return String(value).endsWith(String(compareValue));
        case 'in':
          return Array.isArray(compareValue) && compareValue.includes(value);
        case 'notIn':
          return Array.isArray(compareValue) && !compareValue.includes(value);
        case 'isNull':
          return value === null || value === undefined;
        case 'isNotNull':
          return value !== null && value !== undefined;
        default:
          return false;
      }
    });

    return filter.condition === 'AND'
      ? results.every((r: boolean) => r)
      : results.some((r: boolean) => r);
  }
}
