// ============================================
// JOIN PROCESSOR - Handles all JOIN types
// ============================================

import type { JoinCondition, JoinType } from '../sql-types';

export class JoinProcessor {
  /**
   * Processa JOIN entre duas tabelas
   */
  processJoin(
    leftRecords: any[],
    rightRecords: any[],
    joinCondition: JoinCondition | null,
    joinType: JoinType,
    leftTableAlias?: string,
    rightTableAlias?: string,
  ): any[] {
    // CROSS JOIN não tem condição
    if (joinType === 'CROSS JOIN') {
      console.log(
        `🔗 Processing ${joinType} between ${leftTableAlias} and ${rightTableAlias}`,
      );
      return this.crossJoin(
        leftRecords,
        rightRecords,
        leftTableAlias!,
        rightTableAlias!,
      );
    }

    if (!joinCondition) {
      throw new Error(`JOIN condition is required for ${joinType}`);
    }

    const leftAlias = joinCondition.left.table;
    const rightAlias = joinCondition.right.table;
    const leftKey = joinCondition.left.column;
    const rightKey = joinCondition.right.column;

    console.log(
      `🔗 Processing ${joinType} between ${leftAlias} and ${rightAlias}`,
    );
    console.log(`   ON ${leftAlias}.${leftKey} = ${rightAlias}.${rightKey}`);

    switch (joinType) {
      case 'INNER JOIN':
        return this.innerJoin(
          leftRecords,
          rightRecords,
          leftKey,
          rightKey,
          leftAlias,
          rightAlias,
        );
      case 'LEFT JOIN':
        return this.leftJoin(
          leftRecords,
          rightRecords,
          leftKey,
          rightKey,
          leftAlias,
          rightAlias,
        );
      case 'RIGHT JOIN':
        return this.rightJoin(
          leftRecords,
          rightRecords,
          leftKey,
          rightKey,
          leftAlias,
          rightAlias,
        );
      case 'FULL JOIN':
        return this.fullOuterJoin(
          leftRecords,
          rightRecords,
          leftKey,
          rightKey,
          leftAlias,
          rightAlias,
        );
      default:
        throw new Error(`Unsupported join type: ${joinType}`);
    }
  }

  /**
   * INNER JOIN - apenas registros que têm correspondência em ambas as tabelas
   */
  private innerJoin(
    leftRecords: any[],
    rightRecords: any[],
    leftKey: string,
    rightKey: string,
    leftTableAlias: string,
    rightTableAlias: string,
  ): any[] {
    // Build hash table for smaller table (optimization)
    const [smaller, larger, smallerKey, largerKey, isLeftSmaller] =
      leftRecords.length < rightRecords.length
        ? [leftRecords, rightRecords, leftKey, rightKey, true]
        : [rightRecords, leftRecords, rightKey, leftKey, false];

    const hashTable = this.buildHashTable(smaller, smallerKey);
    const results: any[] = [];

    for (const largerRow of larger) {
      const largerKeyValue = largerRow[largerKey];
      const matchingRows = hashTable.get(largerKeyValue) || [];

      for (const smallerRow of matchingRows) {
        const joinedRow = isLeftSmaller
          ? this.mergeRows(
              smallerRow,
              largerRow,
              leftTableAlias,
              rightTableAlias,
            )
          : this.mergeRows(
              largerRow,
              smallerRow,
              leftTableAlias,
              rightTableAlias,
            );

        results.push(joinedRow);
      }
    }

    console.log(`   ✅ INNER JOIN produced ${results.length} rows`);
    return results;
  }

  /**
   * LEFT JOIN - todos os registros da esquerda + correspondências da direita (ou null)
   */
  private leftJoin(
    leftRecords: any[],
    rightRecords: any[],
    leftKey: string,
    rightKey: string,
    leftTableAlias: string,
    rightTableAlias: string,
  ): any[] {
    const rightHashTable = this.buildHashTable(rightRecords, rightKey);
    const results: any[] = [];

    for (const leftRow of leftRecords) {
      const leftKeyValue = leftRow[leftKey];
      const matchingRightRows = rightHashTable.get(leftKeyValue) || [];

      if (matchingRightRows.length > 0) {
        for (const rightRow of matchingRightRows) {
          results.push(
            this.mergeRows(leftRow, rightRow, leftTableAlias, rightTableAlias),
          );
        }
      } else {
        // Sem correspondência: incluir left com right null
        results.push(
          this.mergeRows(leftRow, null, leftTableAlias, rightTableAlias),
        );
      }
    }

    console.log(`   ✅ LEFT JOIN produced ${results.length} rows`);
    return results;
  }

  /**
   * RIGHT JOIN - todos os registros da direita + correspondências da esquerda (ou null)
   */
  private rightJoin(
    leftRecords: any[],
    rightRecords: any[],
    leftKey: string,
    rightKey: string,
    leftTableAlias: string,
    rightTableAlias: string,
  ): any[] {
    // RIGHT JOIN é como LEFT JOIN invertido
    return this.leftJoin(
      rightRecords,
      leftRecords,
      rightKey,
      leftKey,
      rightTableAlias,
      leftTableAlias,
    );
  }

  /**
   * FULL OUTER JOIN - todos os registros de ambas as tabelas
   */
  private fullOuterJoin(
    leftRecords: any[],
    rightRecords: any[],
    leftKey: string,
    rightKey: string,
    leftTableAlias: string,
    rightTableAlias: string,
  ): any[] {
    const results: any[] = [];
    const rightHashTable = this.buildHashTable(rightRecords, rightKey);
    const matchedRightKeys = new Set<any>();

    // Processar todas as left rows
    for (const leftRow of leftRecords) {
      const leftKeyValue = leftRow[leftKey];
      const matchingRightRows = rightHashTable.get(leftKeyValue) || [];

      if (matchingRightRows.length > 0) {
        for (const rightRow of matchingRightRows) {
          results.push(
            this.mergeRows(leftRow, rightRow, leftTableAlias, rightTableAlias),
          );
          matchedRightKeys.add(rightRow[rightKey]);
        }
      } else {
        // Sem correspondência: incluir left com right null
        results.push(
          this.mergeRows(leftRow, null, leftTableAlias, rightTableAlias),
        );
      }
    }

    // Adicionar right rows que não tiveram match
    for (const rightRow of rightRecords) {
      if (!matchedRightKeys.has(rightRow[rightKey])) {
        results.push(
          this.mergeRows(null, rightRow, leftTableAlias, rightTableAlias),
        );
      }
    }

    console.log(`   ✅ FULL OUTER JOIN produced ${results.length} rows`);
    return results;
  }

  /**
   * CROSS JOIN - produto cartesiano de duas tabelas (cada linha da esquerda com cada linha da direita)
   */
  private crossJoin(
    leftRecords: any[],
    rightRecords: any[],
    leftTableAlias: string,
    rightTableAlias: string,
  ): any[] {
    const results: any[] = [];

    // Produto cartesiano: cada linha da esquerda com cada linha da direita
    for (const leftRow of leftRecords) {
      for (const rightRow of rightRecords) {
        results.push(
          this.mergeRows(leftRow, rightRow, leftTableAlias, rightTableAlias),
        );
      }
    }

    console.log(
      `   ✅ CROSS JOIN produced ${results.length} rows (${leftRecords.length} × ${rightRecords.length})`,
    );
    return results;
  }

  /**
   * Build hash table para lookup rápido
   */
  private buildHashTable(records: any[], keyField: string): Map<any, any[]> {
    const hashTable = new Map<any, any[]>();

    for (const record of records) {
      const keyValue = record[keyField];
      if (!hashTable.has(keyValue)) {
        hashTable.set(keyValue, []);
      }
      hashTable.get(keyValue)!.push(record);
    }

    return hashTable;
  }

  /**
   * Merge dois registros em um único registro com prefixos de tabela
   */
  private mergeRows(
    leftRow: any | null,
    rightRow: any | null,
    leftTableAlias: string,
    rightTableAlias: string,
  ): any {
    const merged: any = {};

    // Adicionar campos da left table com prefixo
    if (leftRow) {
      for (const [key, value] of Object.entries(leftRow)) {
        merged[`${leftTableAlias}.${key}`] = value;
        // Também adicionar sem prefixo se for a tabela principal
        merged[key] = value;
      }
    } else {
      // leftRow é null (RIGHT/FULL JOIN sem match) - precisamos adicionar nulls explícitos
      // para que COALESCE funcione corretamente
      if (rightRow) {
        for (const key of Object.keys(rightRow)) {
          merged[`${leftTableAlias}.${key}`] = null;
        }
      }
    }

    // Adicionar campos da right table com prefixo
    if (rightRow) {
      for (const [key, value] of Object.entries(rightRow)) {
        merged[`${rightTableAlias}.${key}`] = value;
        // Adicionar também sem prefixo (para acesso direto)
        if (!merged.hasOwnProperty(key)) {
          merged[key] = value;
        }
      }
    } else {
      // rightRow é null (LEFT/FULL JOIN sem match) - adicionar nulls explícitos com prefixo
      if (leftRow) {
        for (const key of Object.keys(leftRow)) {
          merged[`${rightTableAlias}.${key}`] = null;
        }
      }
    }

    // Código antigo para fallback (manter por compatibilidade)
    if (leftRow && !rightRow) {
      Object.keys(leftRow).forEach((key) => {
        if (!key.includes('.')) {
          // Adicionar campo da right table como null se não existir
          const rightKey = `${rightTableAlias}.${key}`;
          if (!merged.hasOwnProperty(rightKey)) {
            merged[key] = merged[key] !== undefined ? merged[key] : null;
          }
        }
      });
    }

    return merged;
  }

  /**
   * Processa múltiplos JOINs sequencialmente
   */
  processMultipleJoins(
    tables: Map<string, any[]>,
    joins: Array<{
      type: JoinType;
      table: string;
      alias: string;
      condition: JoinCondition;
    }>,
  ): any[] {
    if (joins.length === 0) {
      // Sem JOINs, retornar apenas a primeira tabela
      const firstTable = Array.from(tables.values())[0];
      return firstTable || [];
    }

    // Começar com a primeira tabela
    let result = Array.from(tables.values())[0] || [];
    const firstTableName = Array.from(tables.keys())[0];

    console.log(
      `🔗 Processing ${joins.length} JOINs starting from ${firstTableName}`,
    );

    // Processar cada JOIN sequencialmente
    for (const join of joins) {
      const rightTable = tables.get(join.table) || [];
      result = this.processJoin(result, rightTable, join.condition, join.type);
    }

    return result;
  }
}
