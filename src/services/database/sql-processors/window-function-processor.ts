// ============================================
// WINDOW FUNCTION PROCESSOR - Handles RANK, ROW_NUMBER, OVER, PARTITION BY
// ============================================

export interface WindowFunction {
  function:
    | 'RANK'
    | 'ROW_NUMBER'
    | 'DENSE_RANK'
    | 'SUM'
    | 'AVG'
    | 'COUNT'
    | 'MIN'
    | 'MAX';
  field?: string; // Campo para agregações (SUM, AVG, etc)
  alias: string;
  partitionBy?: string[]; // PARTITION BY columns
  orderBy?: Array<{ field: string; order: 'ASC' | 'DESC' }>;
}

export class WindowFunctionProcessor {
  /**
   * Processa window functions em um conjunto de registros
   */
  processWindowFunctions(
    records: any[],
    windowFunctions: WindowFunction[],
  ): any[] {
    console.log(`🪟 Processing ${windowFunctions.length} window functions...`);

    // Criar cópia dos registros para adicionar colunas calculadas
    let results = records.map((r) => ({ ...r }));

    // Processar cada window function
    for (const wf of windowFunctions) {
      results = this.applyWindowFunction(results, wf);
    }

    return results;
  }

  /**
   * Aplica uma window function específica
   */
  private applyWindowFunction(records: any[], wf: WindowFunction): any[] {
    console.log(`   Window Function: ${wf.function} AS ${wf.alias}`);

    // Agrupar por PARTITION BY (se houver)
    const partitions = this.partitionRecords(records, wf.partitionBy || []);

    // Processar cada partição
    for (const [partitionKey, partitionRecords] of partitions.entries()) {
      // Ordenar partição se ORDER BY estiver presente
      if (wf.orderBy && wf.orderBy.length > 0) {
        partitionRecords.sort((a, b) =>
          this.compareByOrderBy(a, b, wf.orderBy!),
        );
      }

      // Aplicar função
      this.applyFunctionToPartition(partitionRecords, wf);
    }

    return records;
  }

  /**
   * Particiona registros por campos PARTITION BY
   */
  private partitionRecords(
    records: any[],
    partitionFields: string[],
  ): Map<string, any[]> {
    const partitions = new Map<string, any[]>();

    if (partitionFields.length === 0) {
      // Sem PARTITION BY: todos os registros em uma única partição
      partitions.set('__all__', records);
      return partitions;
    }

    // Agrupar por valores de PARTITION BY
    for (const record of records) {
      const key = partitionFields
        .map((field) => String(record[field] ?? '__NULL__'))
        .join('|');

      if (!partitions.has(key)) {
        partitions.set(key, []);
      }
      partitions.get(key)!.push(record);
    }

    console.log(`   Partitioned into ${partitions.size} groups`);
    return partitions;
  }

  /**
   * Compara dois registros para ordenação
   */
  private compareByOrderBy(
    a: any,
    b: any,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): number {
    for (const { field, order } of orderBy) {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return order === 'ASC' ? comparison : -comparison;
    }
    return 0;
  }

  /**
   * Aplica a função window em uma partição
   */
  private applyFunctionToPartition(
    partitionRecords: any[],
    wf: WindowFunction,
  ): void {
    switch (wf.function) {
      case 'ROW_NUMBER':
        this.applyRowNumber(partitionRecords, wf.alias);
        break;

      case 'RANK':
        this.applyRank(partitionRecords, wf.alias, wf.orderBy || []);
        break;

      case 'DENSE_RANK':
        this.applyDenseRank(partitionRecords, wf.alias, wf.orderBy || []);
        break;

      case 'SUM':
        this.applyRunningSumOrAggregate(
          partitionRecords,
          wf.alias,
          wf.field!,
          'SUM',
        );
        break;

      case 'AVG':
        this.applyRunningSumOrAggregate(
          partitionRecords,
          wf.alias,
          wf.field!,
          'AVG',
        );
        break;

      case 'COUNT':
        this.applyRunningSumOrAggregate(
          partitionRecords,
          wf.alias,
          wf.field,
          'COUNT',
        );
        break;

      case 'MIN':
        this.applyRunningMinMax(partitionRecords, wf.alias, wf.field!, 'MIN');
        break;

      case 'MAX':
        this.applyRunningMinMax(partitionRecords, wf.alias, wf.field!, 'MAX');
        break;

      default:
        throw new Error(`Unsupported window function: ${wf.function}`);
    }
  }

  /**
   * ROW_NUMBER() - Número sequencial dentro da partição
   */
  private applyRowNumber(records: any[], alias: string): void {
    records.forEach((record, index) => {
      record[alias] = index + 1;
    });
  }

  /**
   * RANK() - Ranking com gaps para empates
   */
  private applyRank(
    records: any[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    let currentRank = 1;
    let previousValues: any[] = [];

    records.forEach((record, index) => {
      // Valores atuais para comparação
      const currentValues = orderBy.map((o) => record[o.field]);

      // Se mudou, incrementar rank
      if (index > 0 && !this.arraysEqual(currentValues, previousValues)) {
        currentRank = index + 1;
      }

      record[alias] = currentRank;
      previousValues = currentValues;
    });
  }

  /**
   * DENSE_RANK() - Ranking sem gaps
   */
  private applyDenseRank(
    records: any[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    let currentRank = 1;
    let previousValues: any[] = [];

    records.forEach((record, index) => {
      const currentValues = orderBy.map((o) => record[o.field]);

      if (index > 0 && !this.arraysEqual(currentValues, previousValues)) {
        currentRank++;
      }

      record[alias] = currentRank;
      previousValues = currentValues;
    });
  }

  /**
   * SUM/AVG/COUNT OVER - Agregação na partição completa
   */
  private applyRunningSumOrAggregate(
    records: any[],
    alias: string,
    field: string | undefined,
    func: 'SUM' | 'AVG' | 'COUNT',
  ): void {
    // Calcular agregação para a partição inteira
    let aggregate = 0;

    if (func === 'COUNT') {
      aggregate = field
        ? records.filter((r) => r[field] != null).length
        : records.length;
    } else if (func === 'SUM') {
      aggregate = records.reduce((sum, r) => {
        const val = Number(r[field!]) || 0;
        return sum + val;
      }, 0);
    } else if (func === 'AVG') {
      const sum = records.reduce((s, r) => s + (Number(r[field!]) || 0), 0);
      aggregate = records.length > 0 ? sum / records.length : 0;
    }

    // Aplicar mesmo valor para todos os registros da partição
    records.forEach((record) => {
      record[alias] = aggregate;
    });
  }

  /**
   * MIN/MAX OVER - Valor mínimo/máximo na partição
   */
  private applyRunningMinMax(
    records: any[],
    alias: string,
    field: string,
    func: 'MIN' | 'MAX',
  ): void {
    const values = records.map((r) => Number(r[field]) || 0);
    const result = func === 'MIN' ? Math.min(...values) : Math.max(...values);

    records.forEach((record) => {
      record[alias] = result;
    });
  }

  /**
   * Compara dois arrays
   */
  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
}
