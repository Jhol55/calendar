// ============================================
// CTE PROCESSOR - Handles Common Table Expressions (WITH clause)
// ============================================

type QueryAST = Record<string, unknown>;
type CteDefinition = {
  name: string | { value: string };
  stmt?: { ast?: QueryAST } | QueryAST;
};

export class CteProcessor {
  /**
   * Processa CTEs (WITH clause) e retorna resultados mapeados
   * Suporta CTEs recursivas (WITH RECURSIVE)
   */
  async processCtes(
    ctes: CteDefinition[],
    userId: string,
    executeQuery: (
      ast: QueryAST,
      userId: string,
      cteContext: Map<string, Record<string, unknown>[]>,
    ) => Promise<Record<string, unknown>[]>,
    isRecursive: boolean = false,
    maxIterations: number = 1000,
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const cteResults = new Map<string, Record<string, unknown>[]>();

    console.log(
      `📎 Processing ${ctes.length} CTEs${isRecursive ? ' (RECURSIVE)' : ''}...`,
    );

    // Processar CTEs em ordem (podem referenciar CTEs anteriores)
    for (const cte of ctes) {
      // O nome pode estar em cte.name (string) ou cte.name.value (objeto)
      const cteName =
        typeof cte.name === 'string' ? cte.name : cte.name?.value || 'unknown';

      // O AST da query está em cte.stmt.ast (não em cte.stmt diretamente)
      const cteQuery = (
        cte.stmt && typeof cte.stmt === 'object' && 'ast' in cte.stmt
          ? cte.stmt.ast
          : cte.stmt
      ) as QueryAST;

      console.log(`   CTE: ${cteName}`);

      try {
        // Verificar se é recursiva (tem UNION/UNION ALL)
        if (cteQuery.union || cteQuery.type === 'union' || cteQuery._next) {
          console.log(`   🔄 Recursive CTE detected`);
          const results = await this.processRecursiveCte(
            cteName,
            cteQuery,
            userId,
            executeQuery,
            cteResults,
            maxIterations,
          );
          cteResults.set(cteName, results);
          console.log(
            `   ✅ Recursive CTE ${cteName} produced ${results.length} rows`,
          );
        } else {
          // CTE normal
          const results = await executeQuery(cteQuery, userId, cteResults);
          cteResults.set(cteName, results);
          console.log(`   ✅ CTE ${cteName} produced ${results.length} rows`);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error processing CTE ${cteName}:`, errorMessage);
        console.error(`   CTE Query AST:`, JSON.stringify(cteQuery, null, 2));
        throw error;
      }
    }

    return cteResults;
  }

  /**
   * Processa CTE recursiva com UNION
   */
  private async processRecursiveCte(
    cteName: string,
    unionAst: QueryAST,
    userId: string,
    executeQuery: (
      ast: QueryAST,
      userId: string,
      cteContext: Map<string, Record<string, unknown>[]>,
    ) => Promise<Record<string, unknown>[]>,
    cteContext: Map<string, Record<string, unknown>[]>,
    maxIterations: number = 1000,
  ): Promise<Record<string, unknown>[]> {
    const MAX_ITERATIONS = maxIterations;
    let iteration = 0;
    let allResults: Record<string, unknown>[] = [];
    let previousResults: Record<string, unknown>[] = [];

    // A primeira query é o anchor (no próprio unionAst)
    // A segunda query (recursiva) está em unionAst._next

    const anchorQuery = { ...unionAst } as QueryAST; // Clone to avoid mutation
    const recursiveQuery = unionAst._next as QueryAST | undefined;

    if (!recursiveQuery) {
      console.log(
        `   ⚠️ No recursive query found (_next is missing), executing as simple query`,
      );
      return await executeQuery(unionAst, userId, cteContext);
    }

    // ⚠️ IMPORTANTE: Remover _next do anchor para evitar que executeSelect processe o UNION
    // O CTE processor controla a recursão manualmente
    delete anchorQuery._next;
    delete anchorQuery.set_op; // Também remover o set_op para garantir que não é tratado como UNION

    console.log(`   📝 Found anchor and recursive queries`);

    // Primeira query (âncora/base case)
    previousResults = await executeQuery(anchorQuery, userId, cteContext);
    allResults = [...previousResults];
    console.log(`   Anchor produced ${previousResults.length} rows`);

    // Extrair nomes das colunas do anchor para usar na query recursiva
    const anchorColumnNames =
      previousResults.length > 0 ? Object.keys(previousResults[0]) : [];

    // Executar recursivamente
    while (previousResults.length > 0 && iteration < MAX_ITERATIONS) {
      iteration++;

      // ⚠️ IMPORTANTE: Adicionar APENAS os resultados da iteração anterior ao contexto
      // NÃO usar allResults, senão causa crescimento exponencial!
      const tempContext = new Map(cteContext);
      tempContext.set(cteName, previousResults);

      // Executar query recursiva com contexto atualizado
      const rawNewResults = await executeQuery(
        recursiveQuery,
        userId,
        tempContext,
      );

      if (rawNewResults.length === 0) {
        console.log(
          `   Recursion finished after ${iteration} iterations (no new rows)`,
        );
        break;
      }

      // Renomear colunas para usar os mesmos nomes do anchor
      // Isso é necessário porque em WITH RECURSIVE, as colunas devem ter os mesmos nomes
      const newResults = rawNewResults.map((row) => {
        const renamedRow: Record<string, unknown> = {};
        const rowKeys = Object.keys(row);

        // Mapear cada chave do row para o nome correto do anchor
        rowKeys.forEach((key, index) => {
          if (index < anchorColumnNames.length) {
            renamedRow[anchorColumnNames[index]] = row[key];
          } else {
            renamedRow[key] = row[key]; // Manter nome original se não houver correspondência
          }
        });

        return renamedRow;
      });

      // Detectar se os resultados são idênticos aos anteriores (loop infinito)
      if (newResults.length === previousResults.length) {
        const isDuplicate =
          JSON.stringify(newResults[0]) === JSON.stringify(previousResults[0]);
        if (isDuplicate) {
          console.log(
            `   ⚠️ Detected infinite loop at iteration ${iteration}, stopping`,
          );
          break;
        }
      }

      // Adicionar novos resultados (UNION ALL)
      allResults = [...allResults, ...newResults];
      previousResults = newResults;
    }

    if (iteration >= MAX_ITERATIONS) {
      console.warn(`   ⚠️ Max iterations (${MAX_ITERATIONS}) reached`);
    }

    console.log(
      `   ✅ Recursive CTE complete with ${allResults.length} total rows`,
    );

    return allResults;
  }

  /**
   * Resolve referências a CTEs em uma query
   */
  resolveCteReference(
    tableName: string,
    cteResults: Map<string, Record<string, unknown>[]>,
  ): Record<string, unknown>[] | null {
    return cteResults.get(tableName) || null;
  }
}
