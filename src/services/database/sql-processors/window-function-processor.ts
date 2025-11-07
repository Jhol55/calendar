// ============================================
// WINDOW FUNCTION PROCESSOR - Handles RANK, ROW_NUMBER, OVER, PARTITION BY
// ============================================

type DatabaseRecord = Record<string, unknown>;

export interface WindowFunction {
  function:
    | 'RANK'
    | 'ROW_NUMBER'
    | 'DENSE_RANK'
    | 'SUM'
    | 'AVG'
    | 'COUNT'
    | 'MIN'
    | 'MAX'
    | 'LEAD'
    | 'LAG'
    | 'FIRST_VALUE'
    | 'LAST_VALUE'
    | 'NTH_VALUE'
    | 'NTILE'
    | 'CUME_DIST'
    | 'PERCENT_RANK';
  field?: string; // Campo para agregações/LAG/LEAD/etc
  alias: string;
  partitionBy?: string[]; // PARTITION BY columns
  orderBy?: Array<{ field: string; order: 'ASC' | 'DESC' }>;
  offset?: number; // Para LEAD/LAG
  defaultValue?: unknown; // Para LEAD/LAG
  nth?: number; // Para NTH_VALUE
  buckets?: number; // Para NTILE
}

export class WindowFunctionProcessor {
  /**
   * Processa window functions em um conjunto de registros
   */
  processWindowFunctions(
    records: DatabaseRecord[],
    windowFunctions: WindowFunction[],
  ): DatabaseRecord[] {
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
  private applyWindowFunction(
    records: DatabaseRecord[],
    wf: WindowFunction,
  ): DatabaseRecord[] {
    console.log(`   Window Function: ${wf.function} AS ${wf.alias}`);

    // Agrupar por PARTITION BY (se houver)
    const partitions = this.partitionRecords(records, wf.partitionBy || []);

    // Processar cada partição
    for (const [, partitionRecords] of partitions.entries()) {
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
    records: DatabaseRecord[],
    partitionFields: string[],
  ): Map<string, DatabaseRecord[]> {
    const partitions = new Map<string, DatabaseRecord[]>();

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
    a: DatabaseRecord,
    b: DatabaseRecord,
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
    partitionRecords: DatabaseRecord[],
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

      case 'LEAD':
        this.applyLead(
          partitionRecords,
          wf.alias,
          wf.field!,
          wf.offset || 1,
          wf.defaultValue,
        );
        break;

      case 'LAG':
        this.applyLag(
          partitionRecords,
          wf.alias,
          wf.field!,
          wf.offset || 1,
          wf.defaultValue,
        );
        break;

      case 'FIRST_VALUE':
        this.applyFirstValue(partitionRecords, wf.alias, wf.field!);
        break;

      case 'LAST_VALUE':
        this.applyLastValue(partitionRecords, wf.alias, wf.field!);
        break;

      case 'NTH_VALUE':
        this.applyNthValue(partitionRecords, wf.alias, wf.field!, wf.nth ?? 1);
        break;

      case 'NTILE':
        this.applyNtile(partitionRecords, wf.alias, wf.buckets ?? 4);
        break;

      case 'CUME_DIST':
        this.applyCumeDist(partitionRecords, wf.alias, wf.orderBy || []);
        break;

      case 'PERCENT_RANK':
        this.applyPercentRank(partitionRecords, wf.alias, wf.orderBy || []);
        break;

      default:
        throw new Error(`Unsupported window function: ${wf.function}`);
    }
  }

  /**
   * ROW_NUMBER() - Número sequencial dentro da partição
   */
  private applyRowNumber(records: DatabaseRecord[], alias: string): void {
    records.forEach((record, index) => {
      record[alias] = index + 1;
    });
  }

  /**
   * RANK() - Ranking com gaps para empates
   */
  private applyRank(
    records: DatabaseRecord[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    let currentRank = 1;
    let previousValues: unknown[] = [];

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
    records: DatabaseRecord[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    let currentRank = 1;
    let previousValues: unknown[] = [];

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
    records: DatabaseRecord[],
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
    records: DatabaseRecord[],
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
   * LEAD() - Valor de N linhas à frente
   */
  private applyLead(
    records: DatabaseRecord[],
    alias: string,
    field: string,
    offset: number,
    defaultValue: unknown = null,
  ): void {
    records.forEach((record, index) => {
      const targetIndex = index + offset;
      if (targetIndex < records.length) {
        record[alias] = records[targetIndex][field];
      } else {
        record[alias] = defaultValue;
      }
    });
  }

  /**
   * LAG() - Valor de N linhas atrás
   */
  private applyLag(
    records: DatabaseRecord[],
    alias: string,
    field: string,
    offset: number,
    defaultValue: unknown = null,
  ): void {
    records.forEach((record, index) => {
      const targetIndex = index - offset;
      if (targetIndex >= 0) {
        record[alias] = records[targetIndex][field];
      } else {
        record[alias] = defaultValue;
      }
    });
  }

  /**
   * FIRST_VALUE() - Primeiro valor da janela
   */
  private applyFirstValue(
    records: DatabaseRecord[],
    alias: string,
    field: string,
  ): void {
    const firstValue = records.length > 0 ? records[0][field] : null;
    records.forEach((record) => {
      record[alias] = firstValue;
    });
  }

  /**
   * LAST_VALUE() - Último valor da janela
   */
  private applyLastValue(
    records: DatabaseRecord[],
    alias: string,
    field: string,
  ): void {
    const lastValue =
      records.length > 0 ? records[records.length - 1][field] : null;
    records.forEach((record) => {
      record[alias] = lastValue;
    });
  }

  /**
   * NTH_VALUE() - N-ésimo valor da janela
   */
  private applyNthValue(
    records: DatabaseRecord[],
    alias: string,
    field: string,
    nth: number,
  ): void {
    const nthValue =
      nth > 0 && nth <= records.length ? records[nth - 1][field] : null;
    records.forEach((record) => {
      record[alias] = nthValue;
    });
  }

  /**
   * NTILE() - Dividir em N grupos (buckets)
   */
  private applyNtile(
    records: DatabaseRecord[],
    alias: string,
    buckets: number,
  ): void {
    const totalRecords = records.length;
    const bucketSize = Math.ceil(totalRecords / buckets);

    records.forEach((record, index) => {
      const bucket = Math.min(Math.floor(index / bucketSize) + 1, buckets);
      record[alias] = bucket;
    });
  }

  /**
   * CUME_DIST() - Distribuição cumulativa (0 a 1)
   */
  private applyCumeDist(
    records: DatabaseRecord[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    const totalRecords = records.length;

    records.forEach((record) => {
      // Número de linhas com valor <= valor atual
      const currentValues = orderBy.map((o) => record[o.field]);
      let countLessOrEqual = 0;

      for (let i = 0; i < records.length; i++) {
        const compareValues = orderBy.map((o) => records[i][o.field]);
        const comparison = this.compareValues(
          currentValues,
          compareValues,
          orderBy,
        );
        if (comparison >= 0) {
          // currentValues >= compareValues
          countLessOrEqual++;
        }
      }

      record[alias] = totalRecords > 0 ? countLessOrEqual / totalRecords : 0;
    });
  }

  /**
   * PERCENT_RANK() - Rank percentual (0 a 1)
   */
  private applyPercentRank(
    records: DatabaseRecord[],
    alias: string,
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): void {
    const totalRecords = records.length;

    if (totalRecords <= 1) {
      records.forEach((record) => {
        record[alias] = 0;
      });
      return;
    }

    // Primeiro, aplicar RANK
    let currentRank = 1;
    let previousValues: unknown[] = [];
    const ranks: number[] = [];

    records.forEach((record, index) => {
      const currentValues = orderBy.map((o) => record[o.field]);

      if (index > 0 && !this.arraysEqual(currentValues, previousValues)) {
        currentRank = index + 1;
      }

      ranks.push(currentRank);
      previousValues = currentValues;
    });

    // Calcular PERCENT_RANK = (rank - 1) / (total_rows - 1)
    records.forEach((record, index) => {
      record[alias] = (ranks[index] - 1) / (totalRecords - 1);
    });
  }

  /**
   * Compara valores considerando ORDER BY
   */
  private compareValues(
    a: unknown[],
    b: unknown[],
    orderBy: Array<{ field: string; order: 'ASC' | 'DESC' }>,
  ): number {
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return orderBy[i].order === 'ASC' ? comparison : -comparison;
    }
    return 0;
  }

  /**
   * Compara dois arrays
   */
  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
}
