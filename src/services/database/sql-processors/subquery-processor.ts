// ============================================
// SUBQUERY PROCESSOR - Handles nested queries
// ============================================

export class SubqueryProcessor {
  /**
   * Resolve subqueries no AST antes da execução principal
   */
  async resolveSubqueries(
    ast: any,
    userId: string,
    executeQuery: (ast: any, userId: string) => Promise<any[]>,
  ): Promise<any> {
    // TODO: Implementar resolução de subqueries
    // Por enquanto, apenas retornar o AST original

    // Subqueries podem aparecer em:
    // 1. WHERE clause: WHERE field IN (SELECT ...)
    // 2. FROM clause: FROM (SELECT ...) AS subquery
    // 3. SELECT clause: SELECT (SELECT ...) AS value

    return ast;
  }

  /**
   * Detecta se uma subquery é correlacionada (depende da query pai)
   */
  isCorrelated(subquery: any): boolean {
    // Subquery correlacionada referencia colunas da query pai
    // Exemplo: SELECT * FROM users WHERE age > (SELECT AVG(age) FROM users u2 WHERE u2.city = users.city)

    // Por enquanto, assumir que não é correlacionada
    return false;
  }

  /**
   * Executa subquery simples (não-correlacionada)
   */
  async executeSubquery(
    subqueryAST: any,
    userId: string,
    executeQuery: (ast: any, userId: string) => Promise<any[]>,
  ): Promise<any[]> {
    console.log('📎 Executing subquery...');
    return await executeQuery(subqueryAST, userId);
  }

  /**
   * Executa subquery correlacionada (re-executa para cada row da query pai)
   */
  async executeCorrelatedSubquery(
    subquery: any,
    parentRow: any,
    userId: string,
    executeQuery: (ast: any, userId: string) => Promise<any[]>,
  ): Promise<any[]> {
    // Substituir referências da parent row no subquery
    // Executar subquery com contexto da parent row

    console.warn('⚠️ Correlated subqueries not fully implemented yet');
    return [];
  }
}
