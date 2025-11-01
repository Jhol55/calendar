/* eslint-disable @typescript-eslint/no-unused-vars */
// ============================================
// SQL ENGINE - Main SQL Execution Engine
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Parser } from 'node-sql-parser';
import { prisma } from '@/services/prisma';
import { databaseService } from './database.service';
import { FilterTranslator } from './sql-processors/filter-translator';
import { JoinProcessor } from './sql-processors/join-processor';
import { AggregationProcessor } from './sql-processors/aggregation-processor';
import { SubqueryProcessor } from './sql-processors/subquery-processor';
import { CteProcessor } from './sql-processors/cte-processor';
import { WindowFunctionProcessor } from './sql-processors/window-function-processor';
import type {
  SqlExecutionResult,
  SqlEngineConfig,
  AggregateFunction,
} from './sql-types';
import { DEFAULT_SQL_CONFIG } from './sql-types';
import { replaceVariables } from '@/workers/helpers/variable-replacer';

/**
 * Substitui variáveis em SQL garantindo formato válido
 * Similar ao replaceVariablesInJSON do code-execution-helper, mas formatado para SQL
 */
function replaceVariablesInSQL(sqlTemplate: string, context: any): string {
  return sqlTemplate.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    try {
      const cleanPath = path.trim();
      const parts = cleanPath.split('.');

      let value: any = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          // Tentar acessar como índice numérico primeiro (para arrays)
          const numericIndex = parseInt(part, 10);
          if (
            !isNaN(numericIndex) &&
            Array.isArray(value) &&
            numericIndex >= 0 &&
            numericIndex < value.length
          ) {
            value = value[numericIndex];
          } else if (part in value) {
            value = value[part];
          } else {
            // Variável não encontrada - manter original
            return match;
          }
        } else {
          // Variável não encontrada - manter original
          return match;
        }
      }

      if (value === null) {
        return 'NULL'; // NULL SQL
      }

      if (value === undefined) {
        return match;
      }

      // Converter baseado no tipo - ADICIONAR ASPAS SIMPLES para SQL
      if (typeof value === 'string') {
        // Strings: adicionar aspas simples e escapar aspas internas
        return `'${value.replace(/'/g, "''")}'`;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      // Arrays e Objects: JSON.stringify e adicionar aspas simples para SQL
      try {
        const jsonString = JSON.stringify(value);
        // Escapar aspas simples dentro do JSON
        const escapedJson = jsonString.replace(/'/g, "''");
        return `'${escapedJson}'`;
      } catch {
        return match;
      }
    } catch {
      return match;
    }
  });
}

export class SqlEngine {
  private parser: Parser;
  private filterTranslator: FilterTranslator;
  private joinProcessor: JoinProcessor;
  private aggregationProcessor: AggregationProcessor;
  private subqueryProcessor: SubqueryProcessor;
  private cteProcessor: CteProcessor;
  private windowFunctionProcessor: WindowFunctionProcessor;
  private config: SqlEngineConfig;
  private cteResults: Map<string, any[]> = new Map(); // Armazenar resultados de CTEs
  private queryRateLimit: Map<string, number[]> = new Map(); // Rate limiting por userId

  constructor(config: Partial<SqlEngineConfig> = {}) {
    this.parser = new Parser();
    this.filterTranslator = new FilterTranslator();
    this.joinProcessor = new JoinProcessor();
    this.aggregationProcessor = new AggregationProcessor();
    this.subqueryProcessor = new SubqueryProcessor();
    this.cteProcessor = new CteProcessor();
    this.windowFunctionProcessor = new WindowFunctionProcessor();
    this.config = { ...DEFAULT_SQL_CONFIG, ...config };
  }

  /**
   * Extrai cláusula RETURNING do SQL antes do parsing
   * Retorna o SQL sem RETURNING e a informação da cláusula extraída
   */
  private extractReturningClause(
    sql: string,
  ): { sql: string; returningClause: string } | null {
    // Normalize SQL: replace newlines with spaces for simpler regex matching
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    // Match RETURNING followed by whitespace and then either * or column list
    const returningRegex = /\bRETURNING\s+(\*|[^\s,]+(?:\s*,\s*[^\s,]+)*)/gi;
    const match = returningRegex.exec(normalizedSql);

    if (!match) {
      return null;
    }

    const fullClause = match[0]; // e.g., "RETURNING *" or "RETURNING id, name"
    const columns = fullClause.substring(10).trim(); // Extract after "RETURNING "

    // Calculate approximate position in original SQL
    const originalPos = sql.toLowerCase().indexOf('returning');

    if (originalPos === -1) {
      return null;
    }

    // Remove RETURNING clause from original SQL
    const cleanedSql = sql.substring(0, originalPos).trim();

    return {
      sql: cleanedSql,
      returningClause: columns,
    };
  }

  /**
   * Injeta a cláusula RETURNING de volta no AST após o parsing
   */
  private injectReturningClause(
    ast: any,
    returningInfo: { returningClause: string },
  ): void {
    const statements = Array.isArray(ast) ? ast : [ast];

    // Apenas DML operations (INSERT, UPDATE, DELETE) suportam RETURNING
    for (const statement of statements) {
      const type = statement.type?.toUpperCase();
      if (type === 'INSERT' || type === 'UPDATE' || type === 'DELETE') {
        // Parse the RETURNING clause to AST format
        statement.returning = this.parseReturningColumns(
          returningInfo.returningClause,
        );
      }
    }
  }

  /**
   * Converte string de colunas RETURNING para formato AST
   * Ex: "*" -> [{ type: 'column_ref', column: '*' }]
   * Ex: "id, name" -> [{ type: 'column_ref', column: 'id' }, { type: 'column_ref', column: 'name' }]
   */
  private parseReturningColumns(columnsStr: string): any[] {
    if (columnsStr === '*') {
      return [{ type: 'column_ref', column: '*' }];
    }

    // Parse columns separated by comma
    const columns = columnsStr.split(',').map((col) => col.trim());
    return columns.map((col) => ({
      type: 'column_ref',
      column: col,
    }));
  }

  /**
   * Executa uma query SQL
   */
  async execute(
    sql: string,
    userId: string,
    variableContext: Record<string, unknown> = {},
  ): Promise<SqlExecutionResult> {
    const startTime = Date.now();

    try {
      // Validar SQL vazio
      if (!sql || sql.trim().length === 0) {
        throw new Error('SQL query cannot be empty');
      }

      // Validar tamanho máximo da query SQL
      if (sql.length > this.config.MAX_SQL_LENGTH) {
        throw new Error(
          `Query SQL excede o tamanho máximo permitido (${this.config.MAX_SQL_LENGTH} caracteres).`,
        );
      }

      // Rate limiting por userId
      this.checkRateLimit(userId);

      console.log(`🔷 [SQL-ENGINE] Executing SQL for user ${userId}`);
      console.log(
        `   SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`,
      );

      // 1. Resolver variáveis dinâmicas {{...}}
      const resolvedSql = replaceVariablesInSQL(sql, variableContext);
      console.log(`   Resolved SQL: ${resolvedSql.substring(0, 200)}`);

      // Validar SQL resolvido vazio
      if (
        !resolvedSql ||
        (typeof resolvedSql === 'string' && resolvedSql.trim().length === 0)
      ) {
        throw new Error('SQL query cannot be empty after variable replacement');
      }

      // Validar variáveis dinâmicas contra SQL injection
      this.validateVariableSafety(sql, variableContext);

      // 1.5. Validar comandos bloqueados ANTES do parsing
      const sqlUpper = (resolvedSql as string).trim().toUpperCase();
      const blockedCommands = ['TRUNCATE', 'GRANT', 'REVOKE'];
      for (const cmd of blockedCommands) {
        if (sqlUpper.startsWith(cmd)) {
          throw new Error(
            `Operação SQL não permitida: ${cmd}. Esta operação não é suportada em tabelas virtuais JSONB.`,
          );
        }
      }

      // 2. Pre-process SQL for unsupported keywords
      // Convert ILIKE to LIKE (case-insensitive handling done separately)
      let preprocessedSql = resolvedSql.replace(/\bILIKE\b/gi, 'LIKE');
      preprocessedSql = preprocessedSql.replace(
        /\bNOT\s+ILIKE\b/gi,
        'NOT LIKE',
      );

      // Pre-process RETURNING clause (not supported by node-sql-parser yet)
      const returningInfo = this.extractReturningClause(preprocessedSql);
      if (returningInfo) {
        preprocessedSql = returningInfo.sql;
      }

      // 3. Parse SQL
      let ast: any;
      try {
        ast = this.parser.astify(preprocessedSql as string);
      } catch (error: any) {
        throw new Error(`SQL Syntax Error: ${error.message}`);
      }

      // Inject RETURNING clause back into AST
      if (returningInfo) {
        this.injectReturningClause(ast, returningInfo);
      }

      // Mark ILIKE operations for case-insensitive handling
      const hasILIKE = /\bILIKE\b/gi.test(resolvedSql);
      if (hasILIKE) {
        this.markILIKEInAST(ast);
      }

      // Array de statements (pode ter múltiplos)
      const statements = Array.isArray(ast) ? ast : [ast];

      // Validar AST malformado
      if (!statements || statements.length === 0) {
        throw new Error('AST inválido após parsing.');
      }

      // Validar profundidade de subqueries
      for (const statement of statements) {
        this.validateSubqueryDepth(statement, 0);
      }

      // 3. Validar segurança
      for (const statement of statements) {
        this.validateSafety(statement);
      }

      // 4. Processar CTEs (WITH clause) se houver
      for (const statement of statements) {
        if (statement.with) {
          // Verificar se é WITH RECURSIVE
          // O parser pode colocar em statement.with_recursive, statement.recursive, ou dentro do with
          const isRecursive =
            statement.with_recursive ||
            statement.recursive ||
            (statement.with && statement.with[0]?.recursive) ||
            false;
          console.log(
            `🔷 [SQL-ENGINE] Processing WITH${isRecursive ? ' RECURSIVE' : ''} clause (CTEs)`,
          );

          this.cteResults = await this.cteProcessor.processCtes(
            statement.with,
            userId,
            async (
              cteAst: any,
              userId: string,
              cteContext: Map<string, any[]>,
            ) => {
              return await this.executeSelect(cteAst, userId, cteContext);
            },
            isRecursive,
            this.config.MAX_CTE_ITERATIONS,
          );
        }
      }

      // 5. Executar cada statement com timeout
      const results: any[] = [];
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Query excedeu o tempo máximo de execução (${this.config.QUERY_TIMEOUT_MS} ms).`,
            ),
          );
        }, this.config.QUERY_TIMEOUT_MS);
      });

      const executionPromise = (async () => {
        for (const statement of statements) {
          const result = await this.executeStatement(statement, userId);
          results.push(result);
        }
        return results;
      })();

      // Executar com timeout
      await Promise.race([executionPromise, timeoutPromise]);

      // 6. Limpar CTEs após execução
      this.cteResults.clear();

      // Calcular métricas de performance
      const duration = Date.now() - startTime;
      const recordCount = Array.isArray(results[0])
        ? results[0].length
        : results.length;

      console.log(
        `✅ [SQL-ENGINE] Query executed in ${duration}ms, returned ${recordCount} records`,
      );

      // Alerta para queries lentas
      if (duration > 5000) {
        console.warn(
          `⚠️ [SQL-ENGINE] Slow query detected: ${duration}ms for user ${userId}`,
        );
      }

      // 7. Se apenas um statement, retornar direto
      if (results.length === 1) {
        return {
          success: true,
          data: results[0],
        };
      }

      // 8. Múltiplos statements: retornar array
      return {
        success: true,
        data: results,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ [SQL-ENGINE] Error after ${duration}ms:`,
        error.message,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Executa um statement SQL individual
   */
  private async executeStatement(ast: any, userId: string): Promise<any> {
    // Validar AST malformado
    if (!ast || !ast.type) {
      throw new Error('AST inválido: statement sem tipo definido.');
    }

    const type = ast.type?.toUpperCase();

    console.log(`   Statement type: ${type}`);

    switch (type) {
      case 'SELECT':
        // Para SELECT, passar o contexto de CTEs se disponível
        return await this.executeSelect(ast, userId, this.cteResults);
      case 'INSERT':
        return await this.executeInsert(ast, userId);
      case 'UPDATE':
        return await this.executeUpdate(ast, userId);
      case 'DELETE':
        return await this.executeDelete(ast, userId);
      case 'CREATE':
        return await this.executeCreate(ast, userId);
      case 'DROP':
        return await this.executeDrop(ast, userId);
      case 'ALTER':
        return await this.executeAlter(ast, userId);
      default:
        throw new Error(`Unsupported SQL operation: ${type}`);
    }
  }

  /**
   * Executa SELECT query
   */
  private async executeSelect(
    ast: any,
    userId: string,
    cteContext?: Map<string, any[]>,
  ): Promise<any[]> {
    console.log(`📖 [SQL-ENGINE] Executing SELECT`);

    // Processar UNION se existir
    if (ast._next) {
      return await this.processUnion(ast, userId, cteContext);
    }

    // Usar contexto de CTE se fornecido, caso contrário usar o interno
    const effectiveCteResults = cteContext || this.cteResults;

    // 1. Extrair informações da query
    const from = ast.from;

    // SELECT sem FROM (ex: SELECT 1 AS dia) - retornar valores literais
    if (!from || from.length === 0) {
      console.log(`   SELECT without FROM - returning literal values`);
      let records = this.projectColumns([{}], ast.columns);
      // Processar subqueries escalares se houver
      records = await this.evaluateScalarSubqueries(
        records,
        userId,
        effectiveCteResults,
        undefined, // No original records for literals
      );
      return records;
    }

    // 2. Carregar tabela principal
    const mainTable = from[0];
    let mainTableName: string;
    let mainTableAlias: string;
    let records: any[];

    // Verificar se é uma subquery (derived table)
    if (
      mainTable.expr?.type === 'select' ||
      mainTable.expr?.ast?.type === 'select'
    ) {
      // FROM (SELECT ...) AS alias
      const subqueryAst = mainTable.expr.ast || mainTable.expr;
      mainTableAlias = mainTable.as || 'subquery';
      mainTableName = mainTableAlias; // Para derived tables, usar o alias como nome
      console.log(
        `   Main table is a derived table (subquery): ${mainTableAlias}`,
      );

      // Executar subquery
      records = await this.executeSelect(
        subqueryAst,
        userId,
        effectiveCteResults,
      );
      console.log(`   Derived table returned ${records.length} records`);
    } else {
      // Tabela normal ou CTE
      mainTableName = mainTable.table;
      mainTableAlias = mainTable.as || mainTableName;
      console.log(`   Main table: ${mainTableName} (alias: ${mainTableAlias})`);

      // Carregar dados: verificar se é CTE ou tabela física
      const cteData = this.cteProcessor.resolveCteReference(
        mainTableName,
        effectiveCteResults,
      );

      if (cteData) {
        console.log(`   Loading from CTE: ${mainTableName}`);
        records = cteData;
      } else {
        // Carregar da tabela física
        records = await databaseService.getRecords(userId, mainTableName, {
          pagination: { limit: this.config.MAX_RECORDS_PER_TABLE, offset: 0 },
        });
        console.log(
          `   Loaded ${records.length} records from ${mainTableName}`,
        );
      }
    }

    // 3. Processar JOINs (se houver)
    const hasJoins = from.length > 1 || ast.from[0].join;
    if (hasJoins) {
      // Contar número de JOINs
      let joinCount = 0;
      if (ast.from[0].join) {
        let currentJoin = ast.from[0].join;
        while (currentJoin) {
          joinCount++;
          currentJoin = currentJoin.next;
        }
      }
      joinCount += from.length - 1; // Tabelas adicionais em FROM

      // Validar limite de JOINs
      if (joinCount > this.config.MAX_JOIN_TABLES) {
        throw new Error(
          `Número de JOINs excede o limite permitido (${this.config.MAX_JOIN_TABLES}).`,
        );
      }

      console.log(`   Before JOIN: ${records.length} records`);
      records = await this.processJoins(
        ast,
        userId,
        records,
        mainTableAlias,
        effectiveCteResults,
      );
      console.log(`   After JOIN: ${records.length} records`);
      if (records.length > 0) {
        console.log(`   Sample record after JOIN:`, records[0]);
      }
    }

    // Adicionar prefixos de alias quando a tabela tem alias diferente do nome (sem JOINs)
    if (!hasJoins && mainTableAlias && mainTableAlias !== mainTableName) {
      console.log(
        `   Adding alias prefix ${mainTableAlias} to records without JOIN`,
      );
      records = records.map((record) => {
        const prefixed: any = {};
        for (const [key, value] of Object.entries(record)) {
          prefixed[`${mainTableAlias}.${key}`] = value;
          prefixed[key] = value;
        }
        return prefixed;
      });
    }

    // 4. Aplicar WHERE (filtros)
    if (ast.where) {
      // Check if WHERE contains functions or complex expressions BEFORE preprocessing
      const hasFunctions = this.whereHasFunctions(ast.where);
      const hasSubqueries = this.whereHasSubqueries(ast.where);

      // Pré-processar subqueries no WHERE (EXISTS, IN, ANY/ALL)
      await this.preprocessWhereSubqueries(
        ast.where,
        userId,
        effectiveCteResults,
      );

      if (hasFunctions || hasSubqueries || this.correlationContext) {
        // Evaluate WHERE directly with function support OR correlation context
        console.log(`   Applying WHERE with functions/subqueries/correlation`);
        {
          // Process SEQUENTIALLY to avoid race conditions with correlationContext
          // when evaluating correlated subqueries (EXISTS, scalar subqueries, etc.)
          const flags: boolean[] = [];
          for (const record of records) {
            const flag = await this.evaluateWhereCondition(
              record,
              ast.where,
              userId,
            );
            flags.push(flag);
          }
          records = records.filter((_, idx) => flags[idx]);
        }
        console.log(`   After WHERE: ${records.length} records`);
      } else {
        // Use FilterConfig for simple conditions
        const filterConfig = this.filterTranslator.translateToFilterConfig(
          ast.where,
        );
        console.log(
          `   Applying WHERE filters:`,
          JSON.stringify(filterConfig, null, 2),
        );
        records = this.applyFilters(records, filterConfig);
        console.log(`   After WHERE: ${records.length} records`);
      }
    }

    // 5. Processar GROUP BY e agregações
    if (ast.groupby || this.hasAggregates(ast.columns)) {
      // GROUP BY pode estar em ast.groupby.columns ou ast.groupby (array direto)
      let groupByFields: string[] = [];
      if (ast.groupby) {
        if (Array.isArray(ast.groupby)) {
          groupByFields = ast.groupby.map((g: any) => g.column);
        } else if (ast.groupby.columns) {
          groupByFields = ast.groupby.columns.map((g: any) => g.column);
        }
      }

      // Suporte a GROUP BY por alias (ex: GROUP BY category onde category é alias de CASE ...)
      if (groupByFields.length > 0) {
        // Para cada campo de GROUP BY que não existe nos registros, tentar computar a expressão correspondente pelo alias
        const missingAliases = groupByFields.filter(
          (field) => records.length > 0 && records[0][field] === undefined,
        );

        if (missingAliases.length > 0) {
          for (const aliasName of missingAliases) {
            const col = (ast.columns || []).find(
              (c: any) => c.as === aliasName,
            );
            if (col && col.expr) {
              // Computar e anexar o valor para cada registro com o alias desejado
              records = records.map((r) => ({
                ...r,
                [aliasName]: this.evaluateSelectExpression(col.expr, r),
              }));
            }
          }
        }
      }
      const aggregates = this.extractAggregates(ast.columns);

      console.log(`   GROUP BY fields:`, groupByFields);
      console.log(`   Aggregates:`, aggregates);

      // Avaliar expressões CASE dentro de agregações antes de agregar
      for (const agg of aggregates) {
        if (agg.caseExpr && agg.field) {
          // Avaliar a expressão CASE para cada registro
          for (const record of records) {
            record[agg.field] = this.evaluateCaseExpression(
              agg.caseExpr,
              record,
            );
          }
        }
      }

      records = this.aggregationProcessor.aggregate(
        records,
        groupByFields,
        aggregates,
      );
      console.log(`   After GROUP BY: ${records.length} groups`);

      // HAVING clause
      if (ast.having) {
        records = this.aggregationProcessor.applyHaving(
          records,
          ast.having,
          userId,
        );
      }
    }

    // 5.5. Processar Window Functions (se houver)
    const windowFunctions = this.extractWindowFunctions(ast.columns);
    if (windowFunctions.length > 0) {
      console.log(`   Processing ${windowFunctions.length} window functions`);
      records = this.windowFunctionProcessor.processWindowFunctions(
        records,
        windowFunctions,
      );
      console.log(`   After window functions: ${records.length} records`);
    }

    // 6. ORDER BY (antes da projeção para usar nomes de colunas originais)
    if (ast.orderby) {
      records = this.applyOrderBy(records, ast.orderby);
    }

    // 7. Projeção de colunas (SELECT columns)
    console.log(`   Before projection: ${records.length} records`);
    console.log(`   Sample record before projection:`, records[0]);

    // Armazenar cópia dos registros originais ANTES da projeção
    // para uso em scalar subqueries correlacionadas
    const originalRecords = records.map((r) => ({ ...r }));

    records = this.projectColumns(records, ast.columns);
    console.log(`   After projection: ${records.length} records`);
    console.log(`   Sample record after projection:`, records[0]);

    // 7.5. Processar subqueries escalares no SELECT (assíncronamente)
    records = await this.evaluateScalarSubqueries(
      records,
      userId,
      effectiveCteResults,
      originalRecords, // Pass original records for correlation
    );

    // 8. DISTINCT
    if (ast.distinct) {
      records = this.applyDistinct(records);
    }

    // 9. LIMIT e OFFSET
    if (ast.limit || ast.offset) {
      let limit: number | undefined;
      let offset = 0;

      // LIMIT pode estar em ast.limit
      if (ast.limit) {
        if (Array.isArray(ast.limit.value)) {
          limit = ast.limit.value[0].value;
          // OFFSET pode estar junto com LIMIT
          if (ast.limit.seperator === 'offset' && ast.limit.value[1]) {
            offset = ast.limit.value[1].value;
          }
        } else {
          limit = ast.limit.value || ast.limit;
        }
      }

      // OFFSET standalone (sem LIMIT)
      if (ast.offset) {
        offset = ast.offset.value || ast.offset;
      }

      // Aplicar OFFSET e LIMIT
      if (limit !== undefined) {
        records = records.slice(offset, offset + limit);
      } else if (offset > 0) {
        // Apenas OFFSET sem LIMIT
        records = records.slice(offset);
      }
    }

    // Validar tamanho máximo do resultado
    if (records.length > this.config.MAX_RESULT_SIZE) {
      throw new Error(
        `Resultado excede o tamanho máximo permitido (${this.config.MAX_RESULT_SIZE} registros). Use LIMIT ou filtros mais específicos.`,
      );
    }

    console.log(`   ✅ SELECT returned ${records.length} records`);
    if (records.length > 0) {
      console.log(`   First record:`, JSON.stringify(records[0], null, 2));
    }
    return records;
  }

  /**
   * Avalia uma expressão do SELECT para um registro (suporta CASE, funções, colunas, literais e expressões aritméticas)
   */
  private evaluateSelectExpression(expr: any, record: any): any {
    if (!expr) return null;
    if (expr.type === 'case') {
      return this.evaluateCaseExpression(expr, record);
    }
    if (expr.type === 'function') {
      return this.evaluateFunctionExpression(expr, record);
    }
    if (expr.type === 'column_ref') {
      return this.extractExpressionValue(expr, record);
    }
    if (expr.type === 'number') {
      return Number(expr.value);
    }
    if (expr.type === 'string' || expr.type === 'single_quote_string') {
      return String(expr.value);
    }
    if (expr.type === 'binary_expr') {
      return this.evaluateMathExpression(expr, record);
    }
    return null;
  }

  /**
   * Processa JOINs
   */
  private async processJoins(
    ast: any,
    userId: string,
    mainRecords: any[],
    mainTableAlias: string,
    cteContext: Map<string, any[]>,
  ): Promise<any[]> {
    // Extrair JOINs do AST
    for (const fromItem of ast.from) {
      if (fromItem.join) {
        const joinType = fromItem.join.toUpperCase() as any;
        const joinTableAlias = fromItem.as || fromItem.table || 'subquery';
        const onCondition = fromItem.on;

        // Carregar dados do lado direito do JOIN
        let joinRecords: any[] = [];

        // Caso 1: JOIN com subquery derivada (FROM (SELECT ...) AS alias)
        if (
          fromItem.expr?.type === 'select' ||
          fromItem.expr?.ast?.type === 'select'
        ) {
          const subqueryAst = fromItem.expr.ast || fromItem.expr;
          console.log(`   Loading JOIN from derived table: ${joinTableAlias}`);
          joinRecords = await this.executeSelect(
            subqueryAst,
            userId,
            cteContext,
          );
        } else {
          // Caso 2: JOIN com CTE ou tabela física
          const joinTableName = fromItem.table;
          const cteData = this.cteProcessor.resolveCteReference(
            joinTableName,
            cteContext,
          );

          if (cteData) {
            console.log(`   Loading JOIN table from CTE: ${joinTableName}`);
            joinRecords = cteData;
          } else {
            console.log(`   Loading JOIN table: ${joinTableName}`);
            joinRecords = await databaseService.getRecords(
              userId,
              joinTableName,
              {
                pagination: {
                  limit: this.config.MAX_RECORDS_PER_TABLE,
                  offset: 0,
                },
              },
            );
          }
        }

        console.log(
          `   JOIN right side alias ${joinTableAlias} has ${joinRecords.length} records`,
        );

        // Processar JOIN
        if (joinType === 'CROSS JOIN') {
          // CROSS JOIN não tem condição ON
          mainRecords = this.joinProcessor.processJoin(
            mainRecords,
            joinRecords,
            null,
            joinType,
            mainTableAlias,
            joinTableAlias,
          );
        } else {
          // Outros JOINs têm condição ON
          console.log(
            `   ON condition AST:`,
            JSON.stringify(onCondition, null, 2),
          );

          // Extrair colunas do AST (podem estar em diferentes estruturas)
          let leftColumn, rightColumn;
          let additionalFilter: any = null;

          // Caso 1: Condição simples (column_ref direto)
          if (onCondition.left?.column && onCondition.right?.column) {
            // Determinar qual coluna pertence à tabela LEFT e qual à RIGHT
            const leftTable = onCondition.left.table || null;
            const rightTable = onCondition.right.table || null;

            // Se temos informação de tabela, verificar qual é qual
            if (leftTable === mainTableAlias) {
              leftColumn = onCondition.left.column;
              rightColumn = onCondition.right.column;
            } else if (rightTable === mainTableAlias) {
              // Inverter: right do AST é a tabela LEFT do JOIN
              leftColumn = onCondition.right.column;
              rightColumn = onCondition.left.column;
            } else {
              // Fallback: assumir ordem do AST
              leftColumn = onCondition.left.column;
              rightColumn = onCondition.right.column;
            }
          }
          // Caso 2: AND com múltiplas condições
          else if (
            onCondition.operator === 'AND' &&
            onCondition.left?.type === 'binary_expr'
          ) {
            // onCondition.left é a primeira condição (JOIN entre tabelas)
            const leftTable = onCondition.left.left?.table || null;
            const rightTable = onCondition.left.right?.table || null;

            if (leftTable === mainTableAlias) {
              leftColumn = onCondition.left.left?.column;
              rightColumn = onCondition.left.right?.column;
            } else if (rightTable === mainTableAlias) {
              leftColumn = onCondition.left.right?.column;
              rightColumn = onCondition.left.left?.column;
            } else {
              leftColumn = onCondition.left.left?.column;
              rightColumn = onCondition.left.right?.column;
            }
            // onCondition.right é o filtro adicional
            additionalFilter = onCondition.right;
          }

          mainRecords = this.joinProcessor.processJoin(
            mainRecords,
            joinRecords,
            {
              left: {
                table: mainTableAlias,
                column: leftColumn,
              },
              right: {
                table: joinTableAlias,
                column: rightColumn,
              },
              operator: '=',
            },
            joinType,
          );

          // Aplicar filtro adicional se houver
          if (additionalFilter) {
            console.log(
              `   Applying additional filter:`,
              JSON.stringify(additionalFilter, null, 2),
            );
            mainRecords = mainRecords.filter((record) => {
              // Avaliar condição simples (ex: u.dept_id = 1)
              const leftVal =
                record[additionalFilter.left?.column] ||
                record[`${mainTableAlias}.${additionalFilter.left?.column}`];
              const rightVal = additionalFilter.right?.value;
              return leftVal == rightVal; // Usar == para comparação flexível
            });
          }
        }
      }
    }

    return mainRecords;
  }

  /**
   * Executa INSERT query
   */
  private async executeInsert(ast: any, userId: string): Promise<any> {
    console.log(`➕ [SQL-ENGINE] Executing INSERT`);

    const tableName = ast.table[0].table;
    const columns = ast.columns || [];
    const inserted: any[] = [];

    // Verificar se é INSERT ... SELECT
    // O parser coloca SELECT dentro de ast.values quando type='select'
    if (ast.values && ast.values.type === 'select') {
      // Executar SELECT primeiro
      const selectResults = await this.executeSelect(
        ast.values,
        userId,
        this.cteResults,
      );

      // Inserir cada row do resultado
      for (const row of selectResults) {
        // Se columns foi especificado, mapear apenas essas colunas
        const record: any = {};
        if (columns.length > 0) {
          // Extrair valores pela ordem das colunas do SELECT (ignorar campos internos)
          const selectColumns = ast.values.columns || [];
          const values: any[] = [];

          for (const col of selectColumns) {
            // Tentar encontrar o valor pelo alias ou nome da coluna
            const alias = col.as;
            let value: any = undefined;

            // Se é um literal (número, string, etc), extrair diretamente do AST
            if (col.expr?.type === 'number') {
              value = Number(col.expr.value);
            } else if (
              col.expr?.type === 'string' ||
              col.expr?.type === 'single_quote_string'
            ) {
              value = String(col.expr.value);
            } else if (col.expr?.type === 'bool') {
              value = Boolean(col.expr.value);
            } else if (col.expr?.type === 'null') {
              value = null;
            } else if (alias && row[alias] !== undefined) {
              value = row[alias];
            } else if (col.expr?.type === 'column_ref') {
              const colName = col.expr.column;
              const tableAlias = col.expr.table;

              // Tentar diferentes formatos: alias, table.column, column
              value =
                row[alias || colName] ||
                (tableAlias && row[`${tableAlias}.${colName}`]) ||
                row[colName];
            }

            // Se ainda não encontrou, pegar pela posição (remover campos internos)
            if (value === undefined) {
              const rowKeys = Object.keys(row).filter(
                (k) => !k.startsWith('_'),
              );
              const rowValues = rowKeys.map((k) => row[k]);
              value = rowValues[values.length];
            }

            if (value !== undefined) {
              values.push(value);
            }
          }

          // Mapear valores para as colunas especificadas no INSERT pela ordem
          columns.forEach((col: string, index: number) => {
            if (index < values.length) {
              record[col] = values[index];
            }
          });
        } else {
          // Sem colunas especificadas: mapear pela ordem das colunas do schema da tabela
          const tablePartition = await prisma.dataTable.findFirst({
            where: { userId, tableName, partition: 0 },
            select: { schema: true },
          });

          if (!tablePartition) {
            throw new Error(`Tabela "${tableName}" não existe`);
          }

          const schema = tablePartition.schema as any;
          const schemaColumns = schema.columns.map((c: any) => c.name);

          // Verificar se é SELECT * (todas as colunas)
          const selectColumns = ast.values.columns || [];
          const isSelectAll =
            selectColumns.length === 1 &&
            selectColumns[0].expr?.type === 'column_ref' &&
            selectColumns[0].expr.column === '*' &&
            !selectColumns[0].expr.table;

          let values: any[] = [];

          if (isSelectAll) {
            // SELECT *: pegar valores na ordem em que aparecem no row
            // Remover apenas campos internos, manter ordem original
            const rowKeys = Object.keys(row)
              .filter((k) => !k.startsWith('_'))
              .filter((k) => {
                // Incluir apenas colunas que podem estar no schema de destino
                // ou que são comuns entre origem e destino
                return (
                  schemaColumns.includes(k) ||
                  !k.includes('.') || // Colunas sem prefixo de tabela
                  schemaColumns.some(
                    (sc: string) => k.endsWith(`.${sc}`) || k === sc,
                  )
                );
              });

            // Ordenar pela ordem no schema de destino se possível, senão manter ordem original
            const orderedKeys = rowKeys.sort((a, b) => {
              // Remover prefixo de tabela para comparação
              const cleanA = a.includes('.') ? a.split('.').pop() : a;
              const cleanB = b.includes('.') ? b.split('.').pop() : b;
              const idxA = schemaColumns.indexOf(cleanA || a);
              const idxB = schemaColumns.indexOf(cleanB || b);
              if (idxA >= 0 && idxB >= 0) return idxA - idxB;
              if (idxA >= 0) return -1;
              if (idxB >= 0) return 1;
              return 0; // Manter ordem original
            });

            values = orderedKeys
              .slice(0, schemaColumns.length)
              .map((k) => row[k]);
          } else {
            // SELECT com colunas específicas: extrair pela ordem
            for (const col of selectColumns) {
              // Tentar encontrar o valor pelo alias ou nome da coluna
              const alias = col.as;
              let value: any = undefined;

              if (alias && row[alias] !== undefined) {
                value = row[alias];
              } else if (col.expr?.type === 'column_ref') {
                const colName = col.expr.column;
                const tableAlias = col.expr.table;

                // Tentar diferentes formatos: alias, table.column, column
                value =
                  row[alias || colName] ||
                  (tableAlias && row[`${tableAlias}.${colName}`]) ||
                  row[colName];
              }

              // Se ainda não encontrou, pegar pela posição (remover campos internos)
              if (value === undefined) {
                const rowKeys = Object.keys(row).filter(
                  (k) => !k.startsWith('_'),
                );
                const rowValues = rowKeys.map((k) => row[k]);
                value = rowValues[values.length];
              }

              if (value !== undefined) {
                values.push(value);
              }
            }
          }

          // Mapear valores para colunas da tabela pela ordem
          schemaColumns.forEach((colName: string, index: number) => {
            if (index < values.length) {
              record[colName] = values[index];
            }
          });
        }

        // Remover campos internos antes de inserir
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, _createdAt, _updatedAt, ...cleanRecord } = record;
        const result = await databaseService.insertRecord(
          userId,
          tableName,
          cleanRecord,
        );
        inserted.push(result);
      }
    } else {
      // INSERT com VALUES
      const valuesArray = ast.values?.values || ast.values;

      if (!valuesArray) {
        // Se não há VALUES nem SELECT, pode ser erro no parser ou AST malformado
        console.error('AST values:', JSON.stringify(ast.values, null, 2));
        throw new Error('INSERT must have VALUES or SELECT');
      }

      if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
        throw new Error('INSERT VALUES must be a non-empty array');
      }

      // Se columns está vazio, precisamos inferir do schema da tabela
      let schemaColumns: string[] = [];
      if (columns.length === 0) {
        const tablePartition = await prisma.dataTable.findFirst({
          where: { userId, tableName, partition: 0 },
          select: { schema: true },
        });

        if (!tablePartition) {
          throw new Error(`Tabela "${tableName}" não existe`);
        }

        const schema = tablePartition.schema as any;
        schemaColumns = schema.columns.map((c: any) => c.name);
      }

      // Inserir cada row
      for (const valueSet of valuesArray) {
        const record: any = {};

        valueSet.value.forEach((val: any, index: number) => {
          const columnName =
            columns.length > 0 ? columns[index] : schemaColumns[index];
          record[columnName] = this.extractValue(val);
        });

        const result = await databaseService.insertRecord(
          userId,
          tableName,
          record,
        );
        inserted.push(result);
      }
    }

    console.log(`   ✅ Inserted ${inserted.length} records`);

    // RETURNING clause
    if (ast.returning) {
      console.log(`   Processing RETURNING clause`);
      return this.processReturning(inserted, ast.returning);
    }

    return { affected: inserted.length, records: inserted };
  }

  /**
   * Executa UPDATE query
   */
  private async executeUpdate(ast: any, userId: string): Promise<any> {
    console.log(`✏️ [SQL-ENGINE] Executing UPDATE`);

    const tableName = ast.table[0].table;
    const setValues: any = {};

    // Extrair SET values
    for (const setItem of ast.set) {
      setValues[setItem.column] = this.extractValue(setItem.value);
    }

    // Extrair WHERE
    const filterConfig = ast.where
      ? this.filterTranslator.translateToFilterConfig(ast.where)
      : { condition: 'AND' as const, rules: [] };

    const result = await databaseService.updateRecords(
      userId,
      tableName,
      filterConfig,
      setValues,
    );

    console.log(`   ✅ Updated ${result.affected} records`);

    // RETURNING clause
    if (ast.returning) {
      console.log(`   Processing RETURNING clause`);
      // Buscar os registros atualizados
      const updatedRecords = await databaseService.getRecords(
        userId,
        tableName,
        {
          filters: filterConfig,
          pagination: { limit: this.config.MAX_RECORDS_PER_TABLE, offset: 0 },
        },
      );
      return this.processReturning(updatedRecords, ast.returning);
    }

    return result;
  }

  /**
   * Executa DELETE query
   */
  private async executeDelete(ast: any, userId: string): Promise<any> {
    console.log(`🗑️ [SQL-ENGINE] Executing DELETE`);

    const tableName = ast.from[0].table;

    // Extrair WHERE
    const filterConfig = ast.where
      ? this.filterTranslator.translateToFilterConfig(ast.where)
      : { condition: 'AND' as const, rules: [] };

    // RETURNING clause - buscar registros ANTES de deletar
    let recordsToReturn: any[] = [];
    if (ast.returning) {
      console.log(`   Fetching records for RETURNING clause before deletion`);
      recordsToReturn = await databaseService.getRecords(userId, tableName, {
        filters: filterConfig,
        pagination: { limit: this.config.MAX_RECORDS_PER_TABLE, offset: 0 },
      });
    }

    const result = await databaseService.deleteRecords(
      userId,
      tableName,
      filterConfig,
    );

    console.log(`   ✅ Deleted ${result.affected} records`);

    // RETURNING clause
    if (ast.returning) {
      return this.processReturning(recordsToReturn, ast.returning);
    }

    return result;
  }

  /**
   * Processa cláusula RETURNING
   */
  private processReturning(records: any[], returningClause: any[]): any[] {
    // RETURNING * - retornar todos os campos
    if (
      returningClause.length === 1 &&
      returningClause[0].type === 'column_ref' &&
      returningClause[0].column === '*'
    ) {
      return records;
    }

    // RETURNING specific columns
    return records.map((record) => {
      const result: any = {};
      for (const col of returningClause) {
        if (col.type === 'column_ref') {
          const columnName = col.column;
          const alias = col.as || columnName;
          result[alias] = record[columnName];
        }
      }
      return result;
    });
  }

  /**
   * Executa CREATE TABLE query
   */
  private async executeCreate(ast: any, userId: string): Promise<any> {
    console.log(`📋 [SQL-ENGINE] Executing CREATE TABLE`);

    // Verificar se é CREATE TABLE
    if (ast.keyword !== 'table') {
      throw new Error('Apenas CREATE TABLE é suportado');
    }

    const tableName = ast.table[0].table;

    // Verificar se a tabela já existe
    const existingTable = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
        partition: 0,
      },
    });

    if (existingTable) {
      throw new Error(`Tabela "${tableName}" já existe`);
    }

    const columns: any[] = [];

    // Processar definições de colunas
    for (const colDef of ast.create_definitions || []) {
      if (colDef.resource === 'column') {
        const columnName = colDef.column.column;
        let columnType = 'string'; // Tipo padrão

        // Mapear tipos SQL para tipos JSONB
        const sqlType = colDef.definition?.dataType?.toLowerCase() || '';
        if (
          sqlType.includes('int') ||
          sqlType.includes('numeric') ||
          sqlType.includes('decimal') ||
          sqlType.includes('float') ||
          sqlType.includes('double')
        ) {
          columnType = 'number';
        } else if (sqlType.includes('bool')) {
          columnType = 'boolean';
        } else if (sqlType.includes('date') || sqlType.includes('time')) {
          columnType = 'date';
        } else if (sqlType.includes('json')) {
          columnType = 'object';
        } else if (sqlType.includes('array')) {
          columnType = 'array';
        }

        const isRequired = colDef.nullable?.type === 'not null';
        // O parser coloca UNIQUE em colDef.unique (não em unique_or_primary)
        const isUnique =
          colDef.unique === 'unique' || colDef.unique_or_primary === 'unique';

        columns.push({
          name: columnName,
          type: columnType,
          required: isRequired,
          unique: isUnique,
          default: colDef.default_val?.value?.value || '',
        });
      }
    }

    if (columns.length === 0) {
      throw new Error('CREATE TABLE deve ter pelo menos uma coluna');
    }

    // Criar tabela usando DatabaseService
    await databaseService.addColumns(userId, tableName, columns);

    console.log(
      `   ✅ Created table ${tableName} with ${columns.length} columns`,
    );
    return {
      success: true,
      message: `Tabela ${tableName} criada com sucesso`,
      columns: columns.length,
    };
  }

  /**
   * Executa DROP TABLE ou DROP COLUMN
   */
  private async executeDrop(ast: any, userId: string): Promise<any> {
    console.log(`🗑️ [SQL-ENGINE] Executing DROP`);

    // DROP TABLE
    if (ast.keyword === 'table') {
      const tables = Array.isArray(ast.name) ? ast.name : [ast.name];
      const deletedTables: string[] = [];
      const ifExists = ast.prefix === 'if exists';

      for (const tableObj of tables) {
        const tableName =
          typeof tableObj === 'string' ? tableObj : tableObj.table;

        // Verificar se a tabela existe
        const existingTable = await prisma.dataTable.findFirst({
          where: {
            userId,
            tableName,
            partition: 0,
          },
        });

        if (!existingTable) {
          // Se IF EXISTS, apenas ignora
          if (ifExists) {
            console.log(`   ℹ️  Table ${tableName} does not exist (IF EXISTS)`);
            continue;
          }
          throw new Error(`Tabela "${tableName}" não existe`);
        }

        try {
          // Deletar todas as partições da tabela usando Prisma diretamente
          await prisma.dataTable.deleteMany({
            where: {
              userId,
              tableName,
            },
          });

          deletedTables.push(tableName);
          console.log(`   ✅ Dropped table: ${tableName}`);
        } catch (error: any) {
          console.error(
            `   ❌ Error dropping table ${tableName}:`,
            error.message,
          );
          throw new Error(
            `Erro ao deletar tabela ${tableName}: ${error.message}`,
          );
        }
      }

      return {
        success: true,
        message: `Tabela(s) deletada(s): ${deletedTables.join(', ')}`,
        droppedTables: deletedTables,
      };
    }

    throw new Error(`DROP ${ast.keyword} não é suportado. Use DROP TABLE.`);
  }

  /**
   * Executa ALTER TABLE
   */
  private async executeAlter(ast: any, userId: string): Promise<any> {
    console.log(`🔧 [SQL-ENGINE] Executing ALTER TABLE`);
    console.log(`   AST:`, JSON.stringify(ast, null, 2));

    if (ast.keyword !== 'table' && ast.type !== 'alter') {
      throw new Error('Apenas ALTER TABLE é suportado');
    }

    // Extrair nome da tabela
    // Para RENAME TABLE: ast.table é string
    // Para outros: ast.table é array com objetos
    let tableName: string;
    if (typeof ast.table === 'string') {
      tableName = ast.table;
    } else if (Array.isArray(ast.table) && ast.table.length > 0) {
      tableName = ast.table[0].table;
    } else if (ast.table?.table) {
      tableName = ast.table.table;
    } else {
      throw new Error(`Nome da tabela inválido: ${JSON.stringify(ast.table)}`);
    }

    if (!tableName || typeof tableName !== 'string') {
      throw new Error(`Nome da tabela inválido: ${tableName}`);
    }

    const changes: string[] = [];

    // Processar cada alteração
    for (const alteration of ast.expr || []) {
      const action = alteration.action?.toUpperCase();

      switch (action) {
        case 'ADD': {
          // ADD COLUMN
          if (alteration.resource === 'column') {
            const columnName = alteration.column?.column;
            const sqlType =
              alteration.definition?.dataType?.toLowerCase() || '';
            let columnType:
              | 'string'
              | 'number'
              | 'boolean'
              | 'date'
              | 'object'
              | 'array' = 'string';

            // Mapear tipos SQL para tipos JSONB
            if (
              sqlType.includes('int') ||
              sqlType.includes('numeric') ||
              sqlType.includes('decimal') ||
              sqlType.includes('float') ||
              sqlType.includes('double')
            ) {
              columnType = 'number';
            } else if (sqlType.includes('bool')) {
              columnType = 'boolean';
            } else if (sqlType.includes('date') || sqlType.includes('time')) {
              columnType = 'date';
            } else if (sqlType.includes('json')) {
              columnType = 'object';
            } else if (sqlType.includes('array')) {
              columnType = 'array';
            }

            const isRequired = alteration.nullable?.type === 'not null';

            await databaseService.addColumns(userId, tableName, [
              {
                name: columnName,
                type: columnType,
                required: isRequired,
                default: alteration.default_val?.value?.value || '',
              },
            ]);

            changes.push(`ADD COLUMN ${columnName}`);
            console.log(`   ✅ Added column: ${columnName}`);
          }
          break;
        }

        case 'DROP': {
          // DROP COLUMN
          if (alteration.resource === 'column') {
            const columnName = alteration.column?.column;

            // Para remover uma coluna, precisamos recriar a tabela sem ela
            // 1. Carregar todos os registros
            const allRecords = await databaseService.getRecords(
              userId,
              tableName,
              {
                pagination: {
                  limit: this.config.MAX_RECORDS_PER_TABLE,
                  offset: 0,
                },
              },
            );

            // 2. Remover a coluna de todos os registros
            const updatedRecords = allRecords.map((record) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const {
                [columnName]: _removed,
                _id,
                _createdAt,
                _updatedAt,
                ...rest
              } = record;
              return rest;
            });

            // 3. Obter schema atual e remover a coluna
            const schemaPartition = await prisma.dataTable.findFirst({
              where: { userId, tableName, partition: 0 },
              select: { schema: true },
            });

            const currentSchema = schemaPartition?.schema as any;
            const updatedColumns =
              currentSchema?.columns?.filter(
                (col: any) => col.name !== columnName,
              ) || [];

            // 4. Deletar todas as partições da tabela
            await prisma.dataTable.deleteMany({
              where: { userId, tableName },
            });

            // 5. Recriar tabela com schema atualizado
            if (updatedColumns.length > 0) {
              await databaseService.addColumns(
                userId,
                tableName,
                updatedColumns,
              );

              // 6. Inserir registros atualizados (se houver)
              for (const record of updatedRecords) {
                await databaseService.insertRecord(userId, tableName, record);
              }
            }

            changes.push(`DROP COLUMN ${columnName}`);
            console.log(`   ✅ Dropped column: ${columnName}`);
          }
          break;
        }

        case 'RENAME': {
          // RENAME COLUMN
          if (alteration.resource === 'column') {
            const oldName = alteration.old_column?.column;
            const newName = alteration.column?.column;

            // 1. Carregar todos os registros
            const allRecords = await databaseService.getRecords(
              userId,
              tableName,
              {
                pagination: {
                  limit: this.config.MAX_RECORDS_PER_TABLE,
                  offset: 0,
                },
              },
            );

            // 2. Renomear coluna: recriar a tabela com novo schema
            const updatedRecords = allRecords.map((record) => {
              if (oldName in record) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const {
                  [oldName]: value,
                  _id,
                  _createdAt,
                  _updatedAt,
                  ...rest
                } = record;
                return {
                  ...rest,
                  [newName]: value,
                };
              }
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { _id, _createdAt, _updatedAt, ...rest } = record;
              return rest;
            });

            // 3. Deletar tabela antiga
            await prisma.dataTable.deleteMany({
              where: { userId, tableName },
            });

            // 4. Recriar tabela com schema atualizado
            if (updatedRecords.length > 0) {
              const firstRecord = updatedRecords[0];
              const columns = Object.keys(firstRecord)
                .filter((key) => !key.startsWith('_'))
                .map((key) => ({
                  name: key,
                  type: typeof firstRecord[key] as
                    | 'string'
                    | 'number'
                    | 'boolean'
                    | 'date'
                    | 'object'
                    | 'array',
                  required: false,
                  default: '',
                }));

              await databaseService.addColumns(userId, tableName, columns);

              // 5. Inserir registros atualizados
              for (const record of updatedRecords) {
                await databaseService.insertRecord(userId, tableName, record);
              }
            }

            changes.push(`RENAME COLUMN ${oldName} TO ${newName}`);
            console.log(`   ✅ Renamed column: ${oldName} → ${newName}`);
          } else if (alteration.resource === 'table') {
            // RENAME TABLE
            const newTableName = alteration.table;

            // 1. Carregar todos os registros da tabela antiga
            const allRecords = await databaseService.getRecords(
              userId,
              tableName,
              {
                pagination: {
                  limit: this.config.MAX_RECORDS_PER_TABLE,
                  offset: 0,
                },
              },
            );

            // 2. Inferir schema do primeiro registro
            if (allRecords.length > 0) {
              const firstRecord = allRecords[0];
              const columns = Object.keys(firstRecord)
                .filter((key) => !key.startsWith('_'))
                .map((key) => ({
                  name: key,
                  type: typeof firstRecord[key] as
                    | 'string'
                    | 'number'
                    | 'boolean'
                    | 'date'
                    | 'object'
                    | 'array',
                  required: false,
                  default: '',
                }));

              // 3. Criar nova tabela
              await databaseService.addColumns(userId, newTableName, columns);

              // 4. Copiar todos os registros
              for (const record of allRecords) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, _createdAt, _updatedAt, ...data } = record;
                await databaseService.insertRecord(userId, newTableName, data);
              }
            }

            // 5. Deletar tabela antiga
            await prisma.dataTable.deleteMany({
              where: { userId, tableName },
            });

            changes.push(`RENAME TABLE ${tableName} TO ${newTableName}`);
            console.log(`   ✅ Renamed table: ${tableName} → ${newTableName}`);

            return {
              success: true,
              message: `Tabela renomeada de ${tableName} para ${newTableName}`,
              changes,
            };
          }
          break;
        }

        case 'MODIFY':
        case 'CHANGE': {
          // MODIFY/CHANGE COLUMN (alterar tipo, constraints, etc)
          const columnName = alteration.column?.column;
          console.log(
            `   ⚠️ MODIFY/CHANGE COLUMN não é totalmente suportado (schema dinâmico JSONB)`,
          );
          console.log(
            `   Coluna ${columnName} será mantida, mas alterações de tipo serão aplicadas apenas em novos registros`,
          );

          changes.push(
            `MODIFY COLUMN ${columnName} (schema dinâmico, sem alterações retroativas)`,
          );
          break;
        }

        default:
          throw new Error(`Ação ALTER não suportada: ${action}`);
      }
    }

    return {
      success: true,
      message: `Tabela ${tableName} alterada`,
      changes,
    };
  }

  /**
   * Valida segurança da query (bloqueia operações perigosas)
   */
  private validateSafety(ast: any): void {
    const type = ast.type?.toUpperCase();

    // DROP e ALTER agora são permitidos (atuam nas tabelas virtuais JSONB)
    // TRUNCATE, GRANT, REVOKE não fazem sentido no contexto JSONB
    const unsafeOperations = ['TRUNCATE', 'GRANT', 'REVOKE'];

    if (unsafeOperations.includes(type)) {
      throw new Error(
        `Operação SQL não permitida: ${type}. Esta operação não é suportada em tabelas virtuais JSONB.`,
      );
    }
  }

  /**
   * Valida rate limiting por userId
   */
  private checkRateLimit(userId: string): void {
    // Não aplicar rate limiting em ambiente de teste
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Obter timestamps de queries deste usuário
    let userQueries = this.queryRateLimit.get(userId) || [];

    // Remover queries antigas (mais de 1 minuto)
    userQueries = userQueries.filter((timestamp) => timestamp > oneMinuteAgo);

    // Verificar limite
    if (userQueries.length >= this.config.MAX_QUERIES_PER_MINUTE) {
      throw new Error(
        `Limite de queries por minuto atingido (${this.config.MAX_QUERIES_PER_MINUTE}). Tente novamente em alguns instantes.`,
      );
    }

    // Adicionar timestamp atual
    userQueries.push(now);
    this.queryRateLimit.set(userId, userQueries);
  }

  /**
   * Valida variáveis dinâmicas contra SQL injection
   */
  private validateVariableSafety(
    sql: string,
    variableContext: Record<string, unknown>,
  ): void {
    // Extrair todas as variáveis {{...}} do SQL
    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;
    const matches: RegExpExecArray[] = [];
    while ((match = variableRegex.exec(sql)) !== null) {
      matches.push(match);
    }

    // Apenas verificar comandos SQL perigosos explícitos
    // Não bloquear caracteres comuns (aspas, ponto e vírgula) pois podem ser dados legítimos
    const dangerousSqlCommands =
      /\b(DROP|DELETE|TRUNCATE|GRANT|REVOKE|ALTER|CREATE)\b.*\b(TABLE|DATABASE|SCHEMA|USER)\b/gi;

    for (const match of matches) {
      const varName = match[1].trim();
      const varValue = variableContext[varName];

      if (varValue === undefined || varValue === null) {
        continue;
      }

      // Converter valor para string para validação
      const valueStr = String(varValue).trim();

      // Verificar apenas comandos SQL perigosos completos
      // Permitir caracteres comuns que podem aparecer em dados válidos
      if (dangerousSqlCommands.test(valueStr)) {
        throw new Error(
          `Variável dinâmica "${varName}" contém comandos SQL não permitidos. Apenas valores de dados são permitidos em variáveis.`,
        );
      }
    }
  }

  /**
   * Valida profundidade de subqueries
   */
  private validateSubqueryDepth(ast: any, currentDepth: number): void {
    if (currentDepth > this.config.MAX_SUBQUERY_DEPTH) {
      throw new Error(
        `Profundidade de subqueries excede o limite permitido (${this.config.MAX_SUBQUERY_DEPTH}).`,
      );
    }

    // Verificar subqueries em FROM
    if (ast.from) {
      for (const fromItem of Array.isArray(ast.from) ? ast.from : [ast.from]) {
        if (fromItem.expr && fromItem.expr.type === 'select') {
          this.validateSubqueryDepth(fromItem.expr, currentDepth + 1);
        }
      }
    }

    // Verificar subqueries em WHERE
    if (ast.where) {
      this.validateSubqueryDepthInExpression(ast.where, currentDepth + 1);
    }

    // Verificar subqueries em SELECT columns
    if (ast.columns) {
      for (const col of Array.isArray(ast.columns)
        ? ast.columns
        : [ast.columns]) {
        if (col.expr && col.expr.type === 'select') {
          this.validateSubqueryDepth(col.expr, currentDepth + 1);
        }
      }
    }

    // Verificar UNION
    if (ast._next) {
      this.validateSubqueryDepth(ast._next, currentDepth);
    }
  }

  /**
   * Valida profundidade de subqueries em expressões (WHERE, HAVING, etc)
   */
  private validateSubqueryDepthInExpression(expr: any, depth: number): void {
    if (!expr || depth > this.config.MAX_SUBQUERY_DEPTH) {
      if (depth > this.config.MAX_SUBQUERY_DEPTH) {
        throw new Error(
          `Profundidade de subqueries excede o limite permitido (${this.config.MAX_SUBQUERY_DEPTH}).`,
        );
      }
      return;
    }

    // Verificar se é uma subquery
    if (expr.type === 'select') {
      this.validateSubqueryDepth(expr, depth);
      return;
    }

    // Recursivamente verificar operandos
    if (expr.left) {
      this.validateSubqueryDepthInExpression(expr.left, depth);
    }
    if (expr.right) {
      this.validateSubqueryDepthInExpression(expr.right, depth);
    }
    if (expr.expr) {
      this.validateSubqueryDepthInExpression(expr.expr, depth);
    }
    if (Array.isArray(expr.exprList)) {
      for (const subExpr of expr.exprList) {
        this.validateSubqueryDepthInExpression(subExpr, depth);
      }
    }
  }

  /**
   * Verifica se há funções de agregação nas colunas (NÃO window functions)
   */
  private hasAggregates(columns: any[]): boolean {
    return columns.some((col) => {
      // Verificar se há agregação diretamente ou aninhada
      return this.findAggregateInExpression(col.expr) !== null;
    });
  }

  /**
   * Extrai funções de agregação das colunas (NÃO window functions)
   */
  private extractAggregates(columns: any[]): AggregateFunction[] {
    const aggregates: AggregateFunction[] = [];

    for (const col of columns) {
      // Buscar agregações na coluna (pode estar aninhada dentro de funções)
      const aggFunc = this.findAggregateInExpression(col.expr);

      if (aggFunc) {
        // Se a agregação é o nível superior da coluna, usar o alias da coluna
        // Caso contrário, usar alias padrão (ex: AVG(value)) para que possa ser encontrado depois
        const isTopLevel =
          col.expr?.type === 'aggr_func' || col.expr?.type === 'function';
        const alias =
          isTopLevel && col.as
            ? col.as
            : `${aggFunc.function}(${aggFunc.field || '*'})`;

        aggregates.push({
          function: aggFunc.function as any,
          field: aggFunc.field,
          alias,
          separator: aggFunc.separator,
          valueField: aggFunc.valueField,
          caseExpr: aggFunc.caseExpr,
        });
      }
    }

    return aggregates;
  }

  /**
   * Busca recursivamente por funções de agregação em uma expressão
   * (pode estar aninhada dentro de ROUND, etc)
   */
  private findAggregateInExpression(expr: any): {
    function: string;
    field?: string;
    separator?: string;
    valueField?: string;
    caseExpr?: any;
  } | null {
    if (!expr) return null;

    // Agregação direta (sem OVER - não é window function)
    if (expr.type === 'aggr_func' && !expr.over) {
      const func = expr.name.toUpperCase();

      // Extrair campo: pode estar em args.expr ou args.value[0]
      let field: string | undefined;
      let caseExpr: any = undefined;
      const argExpr = expr.args?.expr || expr.args?.value?.[0];

      if (argExpr?.column) {
        field = argExpr.column;
      } else if (argExpr?.type === 'star') {
        field = undefined; // COUNT(*)
      } else if (argExpr?.type === 'case') {
        // Agregação com CASE expression (ex: SUM(CASE WHEN ... THEN 1 ELSE 0 END))
        // Gerar um nome único para o campo calculado
        field = `__case_expr_${Math.random().toString(36).substr(2, 9)}`;
        caseExpr = argExpr; // Armazenar a expressão CASE
      }

      // Extrair separator para STRING_AGG/GROUP_CONCAT
      let separator: string | undefined;
      if (func === 'STRING_AGG' || func === 'GROUP_CONCAT') {
        // Segundo argumento é o separador
        // Pode estar em: args.value[1], args.exprList[1], args.list[1], etc
        const separatorArg =
          expr.args?.value?.[1] ||
          expr.args?.exprList?.[1] ||
          expr.args?.list?.[1] ||
          expr.args?.expr?.[1];
        if (separatorArg) {
          const extracted = this.extractValue(separatorArg);
          separator = extracted != null ? String(extracted) : ',';
        } else {
          separator = ','; // Default
        }
      }

      return { function: func, field, separator, caseExpr };
    }

    // Alguns parsers podem representar agregações como 'function' em vez de 'aggr_func'
    if (expr.type === 'function' && !expr.over) {
      // Extrair nome da função (node-sql-parser usa estrutura name.name[])
      const funcName = expr.name?.name?.[0]?.value?.toUpperCase();
      const aggregateFunctions = new Set([
        'COUNT',
        'SUM',
        'AVG',
        'MIN',
        'MAX',
        'STRING_AGG',
        'GROUP_CONCAT',
        'ARRAY_AGG',
        'JSON_AGG',
        'JSON_OBJECT_AGG',
      ]);

      if (funcName && aggregateFunctions.has(funcName)) {
        // Extrair campo de forma semelhante ao bloco acima
        let field: string | undefined;
        let caseExpr: any = undefined;
        const argExpr = expr.args?.expr || expr.args?.value?.[0];

        if (argExpr?.column) {
          field = argExpr.column;
        } else if (argExpr?.type === 'star') {
          field = undefined; // COUNT(*)
        } else if (argExpr?.type === 'case') {
          // Agregação com CASE expression (ex: SUM(CASE WHEN ... THEN 1 ELSE 0 END))
          // Gerar um nome único para o campo calculado
          field = `__case_expr_${Math.random().toString(36).substr(2, 9)}`;
          caseExpr = argExpr; // Armazenar a expressão CASE
        }

        // Extrair separator para STRING_AGG/GROUP_CONCAT
        let separator: string | undefined;
        if (funcName === 'STRING_AGG' || funcName === 'GROUP_CONCAT') {
          // Segundo argumento é o separador
          // Pode estar em: args.value[1], args.exprList[1], args.list[1], etc
          const separatorArg =
            expr.args?.value?.[1] ||
            expr.args?.exprList?.[1] ||
            expr.args?.list?.[1] ||
            expr.args?.expr?.[1];
          if (separatorArg) {
            const extracted = this.extractValue(separatorArg);
            separator = extracted != null ? String(extracted) : ',';
          } else {
            separator = ','; // Default
          }
        }

        // Extrair valueField para JSON_OBJECT_AGG
        let valueField: string | undefined;
        if (funcName === 'JSON_OBJECT_AGG') {
          const valueArg = expr.args?.value?.[1] || expr.args?.exprList?.[1];
          if (valueArg?.column) {
            valueField = valueArg.column;
          }
        }

        return { function: funcName, field, separator, valueField, caseExpr };
      }
    }

    // Se for uma função (ex: ROUND), buscar agregações nos argumentos
    if (expr.type === 'function' && expr.args?.value) {
      for (const arg of expr.args.value) {
        const aggFunc = this.findAggregateInExpression(arg);
        if (aggFunc) {
          return aggFunc;
        }
      }
    }

    // Se for uma expressão binária (ex: COUNT(*) + 1), buscar agregações nos operandos
    if (expr.type === 'binary_expr') {
      const leftAgg = this.findAggregateInExpression(expr.left);
      if (leftAgg) return leftAgg;

      const rightAgg = this.findAggregateInExpression(expr.right);
      if (rightAgg) return rightAgg;
    }

    return null;
  }

  /**
   * Extrai window functions das colunas
   */
  private extractWindowFunctions(columns: any[]): any[] {
    const windowFunctions: any[] = [];

    for (const col of columns) {
      // Window function pode ser: type: 'function' com over, ou type: 'aggr_func' com over
      if (col.expr?.over) {
        // Extrair nome da função
        let func: string;
        if (col.expr.type === 'function') {
          // Para RANK(), ROW_NUMBER(), etc: name.name[0].value
          func = col.expr.name?.name?.[0]?.value?.toUpperCase() || 'UNKNOWN';
        } else if (col.expr.type === 'aggr_func') {
          // Para SUM() OVER, AVG() OVER, etc
          func = col.expr.name?.toUpperCase() || 'UNKNOWN';
        } else {
          continue;
        }

        // Extrair campo (para agregações)
        let field: string | undefined;
        let nth: number | undefined;
        let buckets: number | undefined;
        let offset: number | undefined;
        let defaultValue: any | undefined;

        if (col.expr.args) {
          const args = col.expr.args.value || [];

          // Campo geralmente é o primeiro argumento para funções que recebem coluna
          if (col.expr.args.expr?.column) {
            field = col.expr.args.expr.column;
          } else if (args[0]?.column) {
            field = args[0].column;
          }

          // Parâmetros específicos por função
          if (func === 'NTH_VALUE') {
            // NTH_VALUE(value, N)
            if (args[1]?.value !== undefined) {
              nth = Number(args[1].value);
            }
          } else if (func === 'NTILE') {
            // NTILE(N)
            if (args[0]?.value !== undefined) {
              buckets = Number(args[0].value);
            }
          } else if (func === 'LEAD' || func === 'LAG') {
            // LEAD(value [, offset [, default]])
            if (args[1]?.value !== undefined) {
              offset = Number(args[1].value);
            }
            if (args[2] !== undefined) {
              // default pode ser number/string/etc
              defaultValue = this.extractExpressionValue(args[2], {} as any);
            }
          }
        }

        const alias = col.as;
        const over = col.expr.over;

        // Extrair PARTITION BY
        const partitionSpec =
          over?.as_window_specification?.window_specification;
        const partitionBy =
          partitionSpec?.partitionby?.map(
            (p: any) => p.expr?.column || p.column,
          ) || [];

        // Extrair ORDER BY
        const orderBy =
          partitionSpec?.orderby?.map((o: any) => ({
            field: o.expr?.column || o.column,
            order: o.type === 'DESC' ? 'DESC' : 'ASC',
          })) || [];

        const wf: any = {
          function: func,
          field,
          alias: alias || `${func}(${field || '*'})`,
          partitionBy,
          orderBy,
        };

        if (nth !== undefined) wf.nth = nth;
        if (buckets !== undefined) wf.buckets = buckets;
        if (offset !== undefined) wf.offset = offset;
        if (defaultValue !== undefined) wf.defaultValue = defaultValue;

        windowFunctions.push(wf);
      }
    }

    return windowFunctions;
  }

  /**
   * Projeta colunas (SELECT columns)
   */
  private projectColumns(records: any[], columns: any[]): any[] {
    // SELECT * - retornar tudo
    if (
      columns.length === 1 &&
      columns[0].expr?.type === 'column_ref' &&
      columns[0].expr?.column === '*' &&
      !columns[0].expr?.table
    ) {
      return records;
    }

    // SELECT specific columns
    return records.map((record) => {
      const projected: any = {};

      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const col = columns[colIndex];
        if (col.expr?.type === 'column_ref') {
          const table = col.expr.table;
          const columnName = col.expr.column;

          if (columnName === '*') {
            // SELECT table.* - incluir todas as colunas da tabela
            if (table) {
              // Com prefixo de tabela: incluir campos que começam com "table."
              for (const [key, value] of Object.entries(record)) {
                if (key.startsWith(`${table}.`)) {
                  // Remover prefixo para a projeção
                  const fieldName = key.substring(table.length + 1);
                  projected[fieldName] = value;
                } else if (!key.includes('.')) {
                  // Também incluir campos sem prefixo
                  projected[key] = value;
                }
              }
            } else {
              // Sem prefixo: incluir todos
              Object.assign(projected, record);
            }
          } else {
            // Coluna específica
            const alias = col.as || columnName;
            // Tentar com e sem prefixo de tabela
            if (table && record[`${table}.${columnName}`] !== undefined) {
              projected[alias] = record[`${table}.${columnName}`];
            } else {
              projected[alias] = record[columnName];
            }
          }
        } else if (col.expr?.type === 'number') {
          // Literal numérico (ex: SELECT 1 AS dia)
          const alias = col.as || String(col.expr.value);
          projected[alias] = Number(col.expr.value);
        } else if (
          col.expr?.type === 'string' ||
          col.expr?.type === 'single_quote_string'
        ) {
          // Literal string
          const alias = col.as || col.expr.value;
          projected[alias] = String(col.expr.value);
        } else if (col.expr?.type === 'binary_expr') {
          // Expressão matemática (ex: SELECT dia + 1)
          const alias = col.as || `col_${colIndex}`;
          projected[alias] = this.evaluateMathExpression(col.expr, record);
        } else if (col.expr?.type === 'aggr_func' && !col.expr?.over) {
          // Aggregate já foi processado (não window function)
          // Extrair campo: pode estar em args.expr.column ou args.value[0].column
          let field: string | undefined;
          if (col.expr.args?.expr?.column) {
            field = col.expr.args.expr.column;
          } else if (col.expr.args?.value?.[0]?.column) {
            field = col.expr.args.value[0].column;
          }
          const alias = col.as || `${col.expr.name}(${field || '*'})`;
          projected[alias] = record[alias];
        } else if (col.expr?.over) {
          // Window function já foi processada
          const alias = col.as;
          if (alias) {
            projected[alias] = record[alias];
          }
        } else if (col.expr?.type === 'case') {
          // CASE WHEN - avaliar a expressão
          const alias = col.as || `col_${colIndex}`;
          // Verificar se o CASE contém subconsultas
          const hasSubqueries = this.caseHasSubqueries(col.expr);

          if (hasSubqueries) {
            // Marcar para processamento assíncrono
            projected[alias] = {
              __isScalarSubquery: true,
              ast: col.expr,
              colIndex,
              isCaseExpression: true,
            };
          } else {
            projected[alias] = this.evaluateCaseExpression(col.expr, record);
          }
        } else if (col.expr?.type === 'function') {
          // Verificar se é uma agregação já processada
          const funcName = col.expr.name?.name?.[0]?.value?.toUpperCase();
          const aggregateFunctions = new Set([
            'COUNT',
            'SUM',
            'AVG',
            'MIN',
            'MAX',
            'STRING_AGG',
            'GROUP_CONCAT',
            'ARRAY_AGG',
            'JSON_AGG',
            'JSON_OBJECT_AGG',
          ]);
          const isAggregate = aggregateFunctions.has(funcName);

          const alias = col.as || `col_${colIndex}`;
          if (isAggregate) {
            // Agregação já processada - copiar do record
            projected[alias] = record[alias];
          } else {
            // Função regular como ROUND, etc - avaliar a expressão
            projected[alias] = this.evaluateFunctionExpression(
              col.expr,
              record,
            );
          }
        } else if (col.expr?.type === 'cast') {
          // CAST(value AS type) - conversão de tipo
          const alias = col.as || `col_${colIndex}`;

          // Verificar se é CAST de agregação
          const castExpr = col.expr.expr;
          let value;

          if (castExpr?.type === 'aggr_func' || castExpr?.type === 'function') {
            // CAST de agregação - pegar do record (já processado)
            const funcName =
              castExpr?.name?.toUpperCase() ||
              castExpr?.name?.name?.[0]?.value?.toUpperCase() ||
              '';
            let field: string | undefined;
            if (castExpr.args?.expr?.column) {
              field = castExpr.args.expr.column;
            } else if (castExpr.args?.value?.[0]?.column) {
              field = castExpr.args.value[0].column;
            }
            const aggAlias = `${funcName}(${field || '*'})`;
            value = record[aggAlias];
          } else {
            // CAST de expressão regular
            value = this.extractExpressionValue(castExpr, record);
          }

          const targetTypeRaw = col.expr.target?.[0]?.dataType || '';
          const targetType = String(targetTypeRaw).toUpperCase();
          projected[alias] = this.castValue(value, targetType);
        } else if (
          col.expr?.type === 'select' ||
          col.expr?.ast?.type === 'select'
        ) {
          // Subquery escalar no SELECT
          // Pode estar em col.expr (direto) ou col.expr.ast (com parentheses)
          const alias = col.as || `col_${colIndex}`;
          // Subqueries escalares devem retornar um único valor
          // Marcar para processamento posterior (precisamos executar de forma assíncrona)
          const subqueryAst = col.expr.ast || col.expr;
          projected[alias] = {
            __isScalarSubquery: true,
            ast: subqueryAst,
            colIndex,
          };
        }
      }

      return projected;
    });
  }

  /**
   * Avalia uma função (ROUND, etc)
   */
  private evaluateFunctionExpression(funcExpr: any, record: any): any {
    const funcName =
      funcExpr.name?.name?.[0]?.value?.toUpperCase() || 'UNKNOWN';
    const args = funcExpr.args?.value || [];

    switch (funcName) {
      case 'ROUND': {
        // ROUND(value, decimals)
        const value = this.evaluateMathExpression(args[0], record);
        const decimals = args[1] ? Number(args[1].value) : 0;
        if (typeof value === 'number') {
          return Number(value.toFixed(decimals));
        }
        return value;
      }

      case 'UPPER': {
        // UPPER(string) - converte para maiúsculas
        const str = this.extractExpressionValue(args[0], record);
        return str != null ? String(str).toUpperCase() : null;
      }

      case 'LOWER': {
        // LOWER(string) - converte para minúsculas
        const str = this.extractExpressionValue(args[0], record);
        return str != null ? String(str).toLowerCase() : null;
      }

      case 'LENGTH': {
        // LENGTH(string) - retorna tamanho
        const str = this.extractExpressionValue(args[0], record);
        return str != null ? String(str).length : null;
      }

      case 'CONCAT': {
        // CONCAT(str1, str2, ...) - concatena strings
        const values = args.map((arg: any) => {
          const val = this.extractExpressionValue(arg, record);
          return val != null ? String(val) : '';
        });
        return values.join('');
      }

      case 'COALESCE': {
        // COALESCE(val1, val2, ...) - retorna primeiro valor não-null
        for (const arg of args) {
          const val = this.extractExpressionValue(arg, record);
          if (val != null) {
            return val;
          }
        }
        return null;
      }

      case 'TRIM': {
        // TRIM(string) - remove espaços
        const str = this.extractExpressionValue(args[0], record);
        return str != null ? String(str).trim() : null;
      }

      case 'SUBSTRING': {
        // SUBSTRING(string, start, length)
        const str = this.extractExpressionValue(args[0], record);
        const start = args[1]
          ? Number(this.extractExpressionValue(args[1], record)) - 1
          : 0; // SQL é 1-indexed
        const length = args[2]
          ? Number(this.extractExpressionValue(args[2], record))
          : undefined;

        if (str == null) return null;
        return length !== undefined
          ? String(str).substring(start, start + length)
          : String(str).substring(start);
      }

      case 'NULLIF': {
        // NULLIF(val1, val2) - retorna NULL se valores forem iguais
        const val1 = this.extractExpressionValue(args[0], record);
        const val2 = this.extractExpressionValue(args[1], record);
        return val1 == val2 ? null : val1;
      }

      case 'ABS': {
        // ABS(number) - valor absoluto
        const num = this.evaluateMathExpression(args[0], record);
        return num != null ? Math.abs(Number(num)) : null;
      }

      case 'CEIL':
      case 'CEILING': {
        // CEIL(number) - arredonda para cima
        const num = this.evaluateMathExpression(args[0], record);
        return num != null ? Math.ceil(Number(num)) : null;
      }

      case 'FLOOR': {
        // FLOOR(number) - arredonda para baixo
        const num = this.evaluateMathExpression(args[0], record);
        return num != null ? Math.floor(Number(num)) : null;
      }

      case 'POWER': {
        // POWER(base, exponent) - potência
        const base = this.evaluateMathExpression(args[0], record);
        const exponent = this.evaluateMathExpression(args[1], record);
        return base != null && exponent != null
          ? Math.pow(Number(base), Number(exponent))
          : null;
      }

      case 'SQRT': {
        // SQRT(number) - raiz quadrada
        const num = this.evaluateMathExpression(args[0], record);
        return num != null ? Math.sqrt(Number(num)) : null;
      }

      case 'MOD': {
        // MOD(dividend, divisor) - resto da divisão (módulo)
        const dividend = this.evaluateMathExpression(args[0], record);
        const divisor = this.evaluateMathExpression(args[1], record);
        return dividend != null && divisor != null && divisor !== 0
          ? Number(dividend) % Number(divisor)
          : null;
      }

      case 'CAST': {
        // CAST(value AS type) - conversão de tipo
        // Parser pode estruturar diferente, tentar ambos formatos
        const value = this.extractExpressionValue(
          args[0] || funcExpr.expr,
          record,
        );
        // Tentar extrair o tipo alvo de múltiplas formas
        const targetTypeRaw: any =
          funcExpr.target?.dataType ||
          funcExpr.target?.value ||
          funcExpr.target?.name ||
          args[1]?.value ||
          args[1]?.dataType ||
          '';

        const targetType = String(targetTypeRaw).toUpperCase();
        return this.castValue(value, targetType);
      }

      case 'CONVERT': {
        // CONVERT(value, type) - conversão de tipo
        const value = this.extractExpressionValue(args[0], record);
        const targetType = (args[1]?.value || '').toUpperCase();

        return this.castValue(value, targetType);
      }

      default:
        console.warn(`⚠️ Unsupported function: ${funcName}`);
        return null;
    }
  }

  /**
   * Converte um valor para um tipo SQL específico
   */
  private castValue(value: any, targetType: string): any {
    if (value === null || value === undefined) return null;

    // Tipos numéricos
    if (
      targetType.includes('INT') ||
      targetType.includes('BIGINT') ||
      targetType.includes('SMALLINT') ||
      targetType.includes('TINYINT')
    ) {
      const num = Number(value);
      return isNaN(num) ? null : Math.floor(num);
    }

    if (
      targetType.includes('DECIMAL') ||
      targetType.includes('NUMERIC') ||
      targetType.includes('FLOAT') ||
      targetType.includes('DOUBLE') ||
      targetType.includes('REAL')
    ) {
      const num = Number(value);
      return isNaN(num) ? null : num;
    }

    // Tipos de string
    if (
      targetType.includes('CHAR') ||
      targetType.includes('VARCHAR') ||
      targetType.includes('TEXT') ||
      targetType.includes('STRING')
    ) {
      return String(value);
    }

    // Booleano
    if (targetType.includes('BOOL')) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      const str = String(value).toLowerCase();
      return str === 'true' || str === '1' || str === 't' || str === 'yes';
    }

    // Data
    if (targetType.includes('DATE') || targetType.includes('TIMESTAMP')) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // JSON
    if (targetType.includes('JSON')) {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    }

    // Fallback: retornar como string
    return String(value);
  }

  /**
   * Avalia uma expressão matemática (operações aritméticas)
   */
  private evaluateMathExpression(expr: any, record: any): any {
    if (!expr) return null;

    // Expressão binária (*, /, +, -)
    if (expr.type === 'binary_expr') {
      const left = this.evaluateMathExpression(expr.left, record);
      const right = this.evaluateMathExpression(expr.right, record);

      // Converter para números
      const leftNum = typeof left === 'number' ? left : Number(left);
      const rightNum = typeof right === 'number' ? right : Number(right);

      switch (expr.operator) {
        case '*':
          return leftNum * rightNum;
        case '/':
          return rightNum !== 0 ? leftNum / rightNum : null;
        case '+':
          return leftNum + rightNum;
        case '-':
          return leftNum - rightNum;
        default:
          return null;
      }
    }

    // Referência a coluna
    if (expr.type === 'column_ref') {
      return this.extractExpressionValue(expr, record);
    }

    // Número literal
    if (expr.type === 'number') {
      return Number(expr.value);
    }

    // Função de agregação (já foi calculada no GROUP BY)
    // Precisamos pegar o valor do record usando o nome da função
    if (expr.type === 'aggr_func' && !expr.over) {
      const func = expr.name?.toUpperCase();
      let field: string | undefined;

      if (expr.args?.expr?.column) {
        field = expr.args.expr.column;
      } else if (expr.args?.value?.[0]?.column) {
        field = expr.args.value[0].column;
      }

      // Nome padrão da agregação (ex: AVG(value))
      const aggKey = field ? `${func}(${field})` : `${func}(*)`;

      // Buscar no record: exatamente pelo nome padrão
      if (record[aggKey] !== undefined) {
        return record[aggKey];
      }

      // Fallback: buscar por qualquer campo que contenha a função
      for (const [key, value] of Object.entries(record)) {
        if (
          key.toLowerCase().includes(func.toLowerCase()) &&
          (!field || key.includes(field))
        ) {
          return value;
        }
      }

      return null;
    }

    // Agregação com OVER (window function já calculada)
    if (expr.type === 'aggr_func' && expr.over) {
      // Buscar pelo alias da window function
      const func = expr.name?.toUpperCase();
      const field = expr.args?.expr?.column;
      const alias = `${func}(${field || '*'})`;

      // Tentar encontrar no record
      if (record[alias] !== undefined) {
        return record[alias];
      }

      // Ou tentar por nome padrão que pode ter sido gerado
      // Procurar por campos que contenham o nome da função
      for (const [key, value] of Object.entries(record)) {
        if (key.includes(func) || key.includes('total_categoria')) {
          return value;
        }
      }

      return null;
    }

    return null;
  }

  /**
   * Verifica se um CASE contém subconsultas
   */
  private caseHasSubqueries(caseExpr: any): boolean {
    if (!caseExpr || !caseExpr.args) {
      return false;
    }

    for (const arg of caseExpr.args) {
      if (arg.type === 'when') {
        // Verificar condição e resultado
        const condHas = this.expressionHasSubquery(arg.cond);
        const resultHas = this.expressionHasSubquery(arg.result);
        if (condHas || resultHas) {
          return true;
        }
      } else if (arg.type === 'else') {
        // Verificar ELSE
        const resultHas = this.expressionHasSubquery(arg.result);
        if (resultHas) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Verifica se uma expressão contém subconsulta
   */
  private expressionHasSubquery(expr: any): boolean {
    if (!expr) return false;

    // Subconsulta direta
    if (expr.type === 'select') {
      return true;
    }

    // Subconsulta encapsulada com ast (parser result wrapper)
    if (expr.ast?.type === 'select') {
      return true;
    }

    // Subconsulta em expr_list
    if (expr.type === 'expr_list' && expr.value) {
      for (const val of expr.value) {
        if (val.type === 'select' || val.ast?.type === 'select') {
          return true;
        }
        // Recursively check items in expr_list
        if (this.expressionHasSubquery(val)) {
          return true;
        }
      }
    }

    // Recursivamente em expressões binárias
    if (expr.type === 'binary_expr') {
      const leftHas = this.expressionHasSubquery(expr.left);
      const rightHas = this.expressionHasSubquery(expr.right);
      return leftHas || rightHas;
    }

    // Recursivamente em funções
    if (expr.type === 'function' && expr.args?.value) {
      for (const arg of expr.args.value) {
        if (this.expressionHasSubquery(arg)) return true;
      }
    }

    return false;
  }

  /**
   * Avalia uma expressão CASE WHEN (versão assíncrona com suporte a subconsultas)
   */
  private async evaluateCaseExpressionAsync(
    caseExpr: any,
    record: any,
    userId: string,
  ): Promise<any> {
    // Processar cada WHEN clause
    for (const arg of caseExpr.args) {
      if (arg.type === 'when') {
        // Avaliar condição (pode conter subconsultas)
        const conditionResult = await this.evaluateExpressionAsync(
          arg.cond,
          record,
          userId,
        );
        if (conditionResult) {
          // Condição verdadeira: retornar resultado
          return await this.extractExpressionValueAsync(
            arg.result,
            record,
            userId,
          );
        }
      } else if (arg.type === 'else') {
        // ELSE clause
        return await this.extractExpressionValueAsync(
          arg.result,
          record,
          userId,
        );
      }
    }

    // Se nenhuma condição for verdadeira e não houver ELSE, retornar null
    return null;
  }

  /**
   * Avalia uma expressão (versão assíncrona com suporte a subconsultas)
   */
  private async evaluateExpressionAsync(
    expr: any,
    record: any,
    userId: string,
  ): Promise<boolean> {
    try {
      if (!expr) return false;

      // IS NULL / IS NOT NULL
      if (expr.operator === 'IS' || expr.operator === 'IS NOT') {
        const left = await this.extractExpressionValueAsync(
          expr.left,
          record,
          userId,
        );
        const isNull = left === null || left === undefined;
        return expr.operator === 'IS' ? isNull : !isNull;
      }

      if (expr.type === 'binary_expr') {
        // Operadores lógicos (AND, OR)
        if (expr.operator === 'AND') {
          const left = await this.evaluateExpressionAsync(
            expr.left,
            record,
            userId,
          );
          const right = await this.evaluateExpressionAsync(
            expr.right,
            record,
            userId,
          );
          return left && right;
        }

        if (expr.operator === 'OR') {
          const left = await this.evaluateExpressionAsync(
            expr.left,
            record,
            userId,
          );
          const right = await this.evaluateExpressionAsync(
            expr.right,
            record,
            userId,
          );
          return left || right;
        }

        // Operadores de comparação
        if (!expr.left || !expr.right) {
          return false;
        }

        const left = await this.extractExpressionValueAsync(
          expr.left,
          record,
          userId,
        );
        const right = await this.extractExpressionValueAsync(
          expr.right,
          record,
          userId,
        );

        switch (expr.operator) {
          case '=':
            return left === right;
          case '!=':
            return left !== right;
          case '>':
            return Number(left) > Number(right);
          case '>=':
            return Number(left) >= Number(right);
          case '<':
            return Number(left) < Number(right);
          case '<=':
            return Number(left) <= Number(right);
          default:
            return false;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extrai valor de expressão (versão assíncrona com suporte a subconsultas)
   */
  private async extractExpressionValueAsync(
    expr: any,
    record: any,
    userId: string,
  ): Promise<any> {
    if (!expr) return null;

    // Subconsulta escalar direta
    if (expr.type === 'select') {
      const subqueryResults = await this.executeSelect(
        expr,
        userId,
        this.cteResults,
      );
      if (!subqueryResults || subqueryResults.length === 0) {
        return null;
      }
      const firstRow = subqueryResults[0];
      if (!firstRow || typeof firstRow !== 'object') {
        return null;
      }
      const values = Object.entries(firstRow)
        .filter(([key]) => !key.startsWith('_'))
        .map(([_, value]) => value);
      return values.length > 0 ? values[0] : null;
    }

    // Subconsulta encapsulada com ast (parser result wrapper)
    if (expr.ast?.type === 'select') {
      const subqueryResults = await this.executeSelect(
        expr.ast,
        userId,
        this.cteResults,
      );
      if (!subqueryResults || subqueryResults.length === 0) {
        return null;
      }
      const firstRow = subqueryResults[0];
      if (!firstRow || typeof firstRow !== 'object') {
        return null;
      }
      const values = Object.entries(firstRow)
        .filter(([key]) => !key.startsWith('_'))
        .map(([_, value]) => value);
      return values.length > 0 ? values[0] : null;
    }

    // Para outros tipos, usar a versão síncrona
    return this.extractExpressionValue(expr, record);
  }

  private evaluateCaseExpression(caseExpr: any, record: any): any {
    // Versão síncrona (sem suporte a subconsultas)

    // Se CASE tem uma expressão (ex: CASE x WHEN 1), avaliar a expressão base
    if (caseExpr.expr) {
      const baseValue = this.extractExpressionValue(caseExpr.expr, record);

      // Comparar com cada WHEN
      for (const arg of caseExpr.args) {
        if (arg.type === 'when') {
          const whenValue = this.extractExpressionValue(arg.cond, record);
          if (baseValue == whenValue) {
            // Use == for type coercion
            return this.extractExpressionValue(arg.result, record);
          }
        } else if (arg.type === 'else') {
          return this.extractExpressionValue(arg.result, record);
        }
      }
      return null;
    }

    // CASE sem expressão base (CASE WHEN condition)
    // Processar cada WHEN clause
    for (const arg of caseExpr.args) {
      if (arg.type === 'when') {
        // Avaliar condição
        const conditionResult = this.evaluateExpression(arg.cond, record);
        if (conditionResult) {
          // Condição verdadeira: retornar resultado
          return this.extractExpressionValue(arg.result, record);
        }
      } else if (arg.type === 'else') {
        // ELSE clause
        return this.extractExpressionValue(arg.result, record);
      }
    }

    // Se nenhuma condição for verdadeira e não houver ELSE, retornar null
    return null;
  }

  /**
   * Avalia uma expressão (para WHERE, CASE, etc)
   */
  private evaluateExpression(expr: any, record: any): boolean {
    try {
      if (!expr) {
        console.warn('⚠️ Expression is null or undefined');
        return false;
      }

      // IS NULL / IS NOT NULL
      if (expr.operator === 'IS' || expr.operator === 'IS NOT') {
        const left = this.extractExpressionValue(expr.left, record);
        const isNull = left === null || left === undefined;
        return expr.operator === 'IS' ? isNull : !isNull;
      }

      if (expr.type === 'binary_expr') {
        // Operadores lógicos (AND, OR)
        if (expr.operator === 'AND') {
          const left = this.evaluateExpression(expr.left, record);
          const right = this.evaluateExpression(expr.right, record);
          return left && right;
        }

        if (expr.operator === 'OR') {
          const left = this.evaluateExpression(expr.left, record);
          const right = this.evaluateExpression(expr.right, record);
          return left || right;
        }

        // Operadores de comparação
        if (!expr.left || !expr.right) {
          console.error(
            '❌ Binary expression missing left or right:',
            JSON.stringify(expr, null, 2),
          );
          return false;
        }

        const left = this.extractExpressionValue(expr.left, record);
        const right = this.extractExpressionValue(expr.right, record);

        switch (expr.operator) {
          case '=':
            return left === right;
          case '!=':
            return left !== right;
          case '>':
            return Number(left) > Number(right); // Converter strings para number
          case '>=':
            return Number(left) >= Number(right);
          case '<':
            return Number(left) < Number(right);
          case '<=':
            return Number(left) <= Number(right);
          default:
            return false;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error evaluating expression:', error);
      console.error('Expression:', JSON.stringify(expr, null, 2));
      console.error('Record sample:', Object.keys(record).slice(0, 10));
      throw error;
    }
  }

  /**
   * Extrai o valor de uma expressão
   */
  private extractExpressionValue(expr: any, record: any): any {
    if (!expr) return null;

    if (expr.type === 'column_ref') {
      // Referência a coluna
      const table = expr.table;
      const column = expr.column;

      let value;
      if (table) {
        // Com prefixo de tabela - procurar no registro primeiro
        const tableColumnKey = `${table}.${column}`;
        if (tableColumnKey in record) {
          // Encontrou com o prefixo completo
          value = record[tableColumnKey];
        } else if (this.correlationContext) {
          // Não encontrou no registro com prefixo, procurar no correlation context
          if (tableColumnKey in this.correlationContext) {
            value = this.correlationContext[tableColumnKey];
          } else if (column in this.correlationContext) {
            value = this.correlationContext[column];
          }
          // NOTE: Removed fallback to record[column] when correlationContext is set
          // This prevents incorrectly matching columns from wrong tables
        } else if (column in record) {
          // Fallback: a maioria dos registros internos não carrega prefixo; usar a coluna direta
          value = record[column];
        }
      } else {
        // Sem prefixo de tabela
        if (column in record) {
          value = record[column];
        } else if (
          this.correlationContext &&
          column in this.correlationContext
        ) {
          value = this.correlationContext[column];
        }
      }

      return value;
    }

    if (expr.type === 'number') {
      return Number(expr.value);
    }

    if (expr.type === 'string' || expr.type === 'single_quote_string') {
      return String(expr.value);
    }

    if (expr.type === 'bool') {
      return Boolean(expr.value);
    }

    if (expr.type === 'null') {
      return null;
    }

    // Subconsulta escalar (já processada)
    if (
      expr.type === 'select' ||
      (expr.type === 'expr_list' && expr.value?.[0]?.type === 'select')
    ) {
      // Subconsultas escalares dentro de expressões (CASE, etc) não são suportadas
      // na avaliação síncrona. Retornar null ou considerar pré-processar.
      console.warn(
        '⚠️ Scalar subquery found in expression - not yet processed',
      );
      return null;
    }

    // Funções PostgreSQL
    if (expr.type === 'function') {
      return this.evaluatePostgresFunction(expr, record);
    }

    // Operadores binários (para expressões matemáticas em SELECT, WHERE, etc)
    if (expr.type === 'binary_expr') {
      return this.evaluateMathExpression(expr, record);
    }

    return null;
  }

  /**
   * Avalia funções PostgreSQL
   */
  private evaluatePostgresFunction(func: any, record: any): any {
    const funcName = func.name?.toUpperCase();

    switch (funcName) {
      case 'RANDOM':
        // RANDOM() retorna número entre 0 e 1
        return Math.random();

      case 'CURRENT_DATE':
      case 'CURDATE':
        // CURRENT_DATE retorna data atual (YYYY-MM-DD)
        return new Date().toISOString().split('T')[0];

      case 'CURRENT_TIMESTAMP':
      case 'NOW':
        // CURRENT_TIMESTAMP retorna timestamp atual
        return new Date().toISOString();

      case 'CURRENT_TIME':
      case 'CURTIME':
        // CURRENT_TIME retorna hora atual (HH:MM:SS)
        return new Date().toISOString().split('T')[1].split('.')[0];

      case 'EXTRACT': {
        // EXTRACT(YEAR FROM date_column)
        const field = func.args?.field?.toUpperCase();
        const source = this.extractExpressionValue(func.args?.source, record);
        if (!source) return null;

        const date = new Date(source);
        switch (field) {
          case 'YEAR':
            return date.getFullYear();
          case 'MONTH':
            return date.getMonth() + 1;
          case 'DAY':
            return date.getDate();
          case 'HOUR':
            return date.getHours();
          case 'MINUTE':
            return date.getMinutes();
          case 'SECOND':
            return date.getSeconds();
          default:
            return null;
        }
      }

      case 'DATE_PART': {
        // DATE_PART('year', date_column) - similar a EXTRACT
        if (!func.args?.value || func.args.value.length < 2) return null;
        const field = this.extractExpressionValue(
          func.args.value[0],
          record,
        )?.toUpperCase();
        const source = this.extractExpressionValue(func.args.value[1], record);
        if (!source) return null;

        const date = new Date(source);
        switch (field) {
          case 'YEAR':
            return date.getFullYear();
          case 'MONTH':
            return date.getMonth() + 1;
          case 'DAY':
            return date.getDate();
          case 'HOUR':
            return date.getHours();
          case 'MINUTE':
            return date.getMinutes();
          case 'SECOND':
            return date.getSeconds();
          default:
            return null;
        }
      }

      case 'DATE_ADD':
      case 'DATEADD': {
        // DATE_ADD(date, INTERVAL 1 DAY)
        if (!func.args?.value || func.args.value.length < 2) return null;
        const date = new Date(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const interval = func.args.value[1];

        // Simplificação: assumir intervalo em dias
        const days = Number(this.extractExpressionValue(interval, record));
        date.setDate(date.getDate() + days);
        return date.toISOString();
      }

      case 'DATE_SUB':
      case 'DATESUB': {
        // DATE_SUB(date, INTERVAL 1 DAY)
        if (!func.args?.value || func.args.value.length < 2) return null;
        const date = new Date(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const interval = func.args.value[1];

        // Simplificação: assumir intervalo em dias
        const days = Number(this.extractExpressionValue(interval, record));
        date.setDate(date.getDate() - days);
        return date.toISOString();
      }

      case 'DATEDIFF': {
        // DATEDIFF(date1, date2) - diferença em dias
        if (!func.args?.value || func.args.value.length < 2) return null;
        const date1 = new Date(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const date2 = new Date(
          this.extractExpressionValue(func.args.value[1], record),
        );

        const diffTime = Math.abs(date1.getTime() - date2.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      }

      case 'UPPER':
      case 'UCASE': {
        // UPPER(string) - converte para maiúsculas
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return String(value).toUpperCase();
      }

      case 'LOWER':
      case 'LCASE': {
        // LOWER(string) - converte para minúsculas
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return String(value).toLowerCase();
      }

      case 'LENGTH':
      case 'CHAR_LENGTH': {
        // LENGTH(string) - tamanho da string
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return String(value).length;
      }

      case 'SUBSTRING':
      case 'SUBSTR': {
        // SUBSTRING(string, start, length)
        if (!func.args?.value || func.args.value.length < 2) return null;
        const str = String(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const start =
          Number(this.extractExpressionValue(func.args.value[1], record)) - 1; // SQL é 1-indexed
        const length = func.args.value[2]
          ? Number(this.extractExpressionValue(func.args.value[2], record))
          : undefined;
        return str.substring(start, length ? start + length : undefined);
      }

      case 'CONCAT': {
        // CONCAT(str1, str2, ...)
        if (!func.args?.value) return '';
        const values = func.args.value.map((v: any) =>
          this.extractExpressionValue(v, record),
        );
        return values.join('');
      }

      case 'COALESCE': {
        // COALESCE(value1, value2, ...) - retorna o primeiro valor não-nulo
        if (!func.args?.value) return null;
        for (const arg of func.args.value) {
          const value = this.extractExpressionValue(arg, record);
          if (value !== null && value !== undefined) {
            return value;
          }
        }
        return null;
      }

      case 'NULLIF': {
        // NULLIF(value1, value2) - retorna NULL se valores forem iguais
        if (!func.args?.value || func.args.value.length < 2) return null;
        const val1 = this.extractExpressionValue(func.args.value[0], record);
        const val2 = this.extractExpressionValue(func.args.value[1], record);
        return val1 === val2 ? null : val1;
      }

      case 'ABS': {
        // ABS(number) - valor absoluto
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return Math.abs(Number(value));
      }

      case 'CEIL':
      case 'CEILING': {
        // CEIL(number) - arredonda para cima
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return Math.ceil(Number(value));
      }

      case 'FLOOR': {
        // FLOOR(number) - arredonda para baixo
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return Math.floor(Number(value));
      }

      case 'POWER':
      case 'POW': {
        // POWER(base, exponent)
        if (!func.args?.value || func.args.value.length < 2) return null;
        const base = Number(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const exponent = Number(
          this.extractExpressionValue(func.args.value[1], record),
        );
        return Math.pow(base, exponent);
      }

      case 'SQRT': {
        // SQRT(number) - raiz quadrada
        if (!func.args?.value || func.args.value.length < 1) return null;
        const value = this.extractExpressionValue(func.args.value[0], record);
        return Math.sqrt(Number(value));
      }

      case 'MOD': {
        // MOD(dividend, divisor) - módulo
        if (!func.args?.value || func.args.value.length < 2) return null;
        const dividend = Number(
          this.extractExpressionValue(func.args.value[0], record),
        );
        const divisor = Number(
          this.extractExpressionValue(func.args.value[1], record),
        );
        return dividend % divisor;
      }

      default:
        console.warn(`⚠️ Unsupported PostgreSQL function: ${funcName}`);
        return null;
    }
  }

  /**
   * Aplica DISTINCT
   */
  private applyDistinct(records: any[]): any[] {
    const seen = new Set<string>();
    return records.filter((record) => {
      const key = JSON.stringify(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Aplica ORDER BY (com suporte a NULLS FIRST/LAST)
   */
  private applyOrderBy(records: any[], orderBy: any[]): any[] {
    return records.sort((a, b) => {
      for (const order of orderBy) {
        // Extrair campo com alias de tabela (ex: c.name)
        const field = order.expr.table
          ? `${order.expr.table}.${order.expr.column}`
          : order.expr.column;
        const direction = order.type === 'DESC' ? -1 : 1;
        const nullsFirst = order.nulls === 'first';
        const nullsLast = order.nulls === 'last';

        // Se field não existir diretamente, tentar com alias de tabela
        let aVal = a[field];
        let bVal = b[field];

        // Se ainda não encontrou, tentar buscar com qualquer prefixo de tabela
        if (aVal === undefined || bVal === undefined) {
          for (const key of Object.keys(a)) {
            if (key.endsWith(`.${field}`)) {
              aVal = a[key];
              break;
            }
          }
          for (const key of Object.keys(b)) {
            if (key.endsWith(`.${field}`)) {
              bVal = b[key];
              break;
            }
          }
        }

        // Tratar NULLs
        const aIsNull = aVal === null || aVal === undefined;
        const bIsNull = bVal === null || bVal === undefined;

        if (aIsNull && bIsNull) continue;

        if (aIsNull) {
          // Se NULLS FIRST explícito, ou se DESC sem especificar (padrão SQL)
          if (nullsFirst || (order.type === 'DESC' && !nullsLast)) {
            return -1;
          }
          return 1;
        }

        if (bIsNull) {
          if (nullsFirst || (order.type === 'DESC' && !nullsLast)) {
            return 1;
          }
          return -1;
        }

        // Comparação normal
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
      }
      return 0;
    });
  }

  /**
   * Verifica se WHERE contém funções
   */
  private whereHasFunctions(node: any): boolean {
    if (!node) return false;

    // Se é uma função, retorna true
    if (node.type === 'function') return true;

    // Se é uma conversão CAST, retorna true
    if (node.type === 'cast') return true;

    // Se é uma expressão binária, verifica os lados
    if (node.type === 'binary_expr') {
      // Check for mathematical expressions (arithmetic operators)
      const arithmeticOps = ['+', '-', '*', '/', '%'];
      if (arithmeticOps.includes(node.operator)) {
        return true;
      }

      // Check if left or right sides have functions or math expressions
      return (
        this.whereHasFunctions(node.left) || this.whereHasFunctions(node.right)
      );
    }

    return false;
  }

  /**
   * Verifica se WHERE contém subqueries (EXISTS, IN, ANY, ALL)
   */
  private whereHasSubqueries(node: any): boolean {
    if (!node) return false;

    // EXISTS / NOT EXISTS
    if (
      (node.type === 'unary_expr' &&
        (node.operator === 'EXISTS' || node.operator === 'NOT EXISTS')) ||
      (node.type === 'function' &&
        (node.name?.name?.[0]?.value === 'EXISTS' ||
          node.name?.name?.[0]?.value === 'NOT EXISTS'))
    ) {
      return true;
    }

    // IN / NOT IN com subquery
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'IN' || node.operator === 'NOT IN')
    ) {
      // Verificar se é subquery (antes do preprocessing)
      // Subqueries aparecem como expr_list com tableList/columnList
      if (node.right?.type === 'select' || node.right?.ast?.type === 'select') {
        return true;
      }
      if (node.right?.type === 'expr_list' && node.right.value?.length === 1) {
        const firstItem = node.right.value[0];
        if (
          firstItem.tableList ||
          firstItem.columnList ||
          (firstItem.ast && firstItem.ast.type === 'select')
        ) {
          return true;
        }
      }
    }

    // ANY / ALL (aparecem como funções)
    if (node.type === 'binary_expr' && node.right?.type === 'function') {
      const funcName = node.right.name?.name?.[0]?.value;
      if (funcName === 'ANY' || funcName === 'ALL') {
        return true;
      }
    }

    // Recursivo para AND/OR
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      return (
        this.whereHasSubqueries(node.left) ||
        this.whereHasSubqueries(node.right)
      );
    }

    return false;
  }

  /**
   * Pré-processa subqueries no WHERE (executa e armazena resultados)
   */
  private async preprocessWhereSubqueries(
    node: any,
    userId: string,
    cteContext: Map<string, any[]>,
  ): Promise<void> {
    if (!node) return;

    // EXISTS / NOT EXISTS: pular pré-processamento para permitir correlação por registro
    if (
      (node.type === 'unary_expr' &&
        (node.operator === 'EXISTS' || node.operator === 'NOT EXISTS')) ||
      (node.type === 'function' &&
        (node.name?.name?.[0]?.value === 'EXISTS' ||
          node.name?.name?.[0]?.value === 'NOT EXISTS'))
    ) {
      return;
    }

    // IN / NOT IN com subquery
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'IN' || node.operator === 'NOT IN')
    ) {
      let subqueryAst = node.right?.ast || node.right;

      // Subquery pode estar em node.right.value[0].ast (expr_list)
      if (node.right?.type === 'expr_list' && node.right.value?.length === 1) {
        const firstItem = node.right.value[0];
        if (firstItem.ast && firstItem.ast.type === 'select') {
          subqueryAst = firstItem.ast;
        }
      }

      if (subqueryAst?.type === 'select') {
        const results = await this.executeSelect(
          subqueryAst,
          userId,
          cteContext,
        );
        // Extrair valores (primeira coluna de cada row)
        const values = results.map((row) => Object.values(row)[0]);
        node.right.__subquery_results = values;
      }
      return;
    }

    // ANY / ALL (aparecem como funções em comparações)
    if (node.type === 'binary_expr' && node.right?.type === 'function') {
      const funcName = node.right.name?.name?.[0]?.value;
      if (funcName === 'ANY' || funcName === 'ALL') {
        // Subquery está em args.value[0]
        const args = node.right.args?.value?.[0];
        if (args) {
          let subqueryAst = args.ast || args;

          // Se estiver em expr_list, pegar o primeiro item
          if (args.type === 'expr_list' && args.value?.length === 1) {
            subqueryAst = args.value[0].ast || args.value[0];
          }

          if (subqueryAst?.type === 'select') {
            const results = await this.executeSelect(
              subqueryAst,
              userId,
              cteContext,
            );
            const values = results.map((row) => Object.values(row)[0]);
            // Armazenar resultados no args para acesso posterior
            args.__subquery_results = values;
          }
        }
      }
      return;
    }

    // Recursivo para AND/OR
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      await this.preprocessWhereSubqueries(node.left, userId, cteContext);
      await this.preprocessWhereSubqueries(node.right, userId, cteContext);
    }
  }

  /**
   * Contexto de correlação para subqueries correlacionadas
   */
  private correlationContext: any = null;

  /**
   * Processa subqueries escalares no SELECT de forma assíncrona
   */
  private async evaluateScalarSubqueries(
    records: any[],
    userId: string,
    cteContext: Map<string, any[]>,
    originalRecords?: any[], // Registros antes da projeção, para correlação
  ): Promise<any[]> {
    // Verificar se há subqueries escalares
    const firstRecord = records[0];
    if (!firstRecord) return records;

    const scalarSubqueries: Array<{ field: string; ast: any }> = [];
    for (const [field, value] of Object.entries(firstRecord)) {
      if (
        value &&
        typeof value === 'object' &&
        (value as any).__isScalarSubquery
      ) {
        scalarSubqueries.push({ field, ast: (value as any).ast });
      }
    }

    if (scalarSubqueries.length === 0) return records;

    // Processar cada registro SEQUENCIALMENTE para evitar race condition no correlationContext
    const processedRecords: any[] = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const newRecord = { ...record };

      // Usar registro original (pré-projeção) para correlação se disponível
      const correlationRecord =
        originalRecords && originalRecords[index]
          ? originalRecords[index]
          : record;

      for (const { field, ast } of scalarSubqueries) {
        try {
          // Verificar se é um CASE expression
          const isCaseExpression = (newRecord[field] as any)?.isCaseExpression;

          if (isCaseExpression) {
            // Processar CASE com subconsultas
            this.correlationContext = correlationRecord;
            newRecord[field] = await this.evaluateCaseExpressionAsync(
              ast,
              correlationRecord,
              userId,
            );
            this.correlationContext = null;
          } else {
            // Definir o contexto de correlação com o registro original
            // Isso permite que referências a colunas da query externa sejam resolvidas
            this.correlationContext = correlationRecord;
            // Executar subquery
            const subqueryResults = await this.executeSelect(
              ast,
              userId,
              cteContext,
            );

            // Limpar contexto de correlação
            this.correlationContext = null;

            // Subquery escalar deve retornar um único valor
            if (!subqueryResults || subqueryResults.length === 0) {
              newRecord[field] = null;
            } else {
              // Pegar o primeiro campo do primeiro registro
              const firstRow = subqueryResults[0];

              if (!firstRow || typeof firstRow !== 'object') {
                newRecord[field] = null;
              } else {
                // Filtrar campos que começam com _ (metadados internos)
                const values = Object.entries(firstRow)
                  .filter(([key]) => !key.startsWith('_'))
                  .map(([_, value]) => value);

                // Pegar o primeiro valor não-metadata
                newRecord[field] = values.length > 0 ? values[0] : null;
              }
            }
          }
        } catch (error: any) {
          console.error(
            `   Error executing scalar subquery for ${field}:`,
            error.message,
          );
          newRecord[field] = null;
        }
      }

      processedRecords.push(newRecord);
    }

    return processedRecords;
  }

  /**
   * Avalia condição WHERE diretamente (suporta funções, subqueries, etc)
   * NOTA: Esta função é síncrona, então subqueries precisam ser pré-processadas
   */
  /**
   * Marca operações LIKE no AST que eram originalmente ILIKE
   */
  private markILIKEInAST(ast: any): void {
    if (!ast) return;

    if (Array.isArray(ast)) {
      ast.forEach((item) => this.markILIKEInAST(item));
      return;
    }

    if (typeof ast === 'object') {
      // Marcar operador LIKE como case-insensitive
      if (ast.operator === 'LIKE' || ast.operator === 'NOT LIKE') {
        ast._ilike = true;
      }

      // Recursivamente processar todos os campos do objeto
      Object.keys(ast).forEach((key) => {
        if (key !== '_ilike') {
          this.markILIKEInAST(ast[key]);
        }
      });
    }
  }

  private async evaluateWhereCondition(
    record: any,
    node: any,
    userId?: string,
  ): Promise<boolean> {
    if (!node) return true;

    // EXISTS / NOT EXISTS (avaliar por registro, suportando correlação)
    // Pode aparecer como unary_expr OU como function
    let isExists = false;
    let isNotExists = false;
    let subqueryAst;

    if (
      node.type === 'unary_expr' &&
      (node.operator === 'EXISTS' || node.operator === 'NOT EXISTS')
    ) {
      isExists = node.operator === 'EXISTS';
      isNotExists = node.operator === 'NOT EXISTS';
      subqueryAst = node.expr?.ast || node.expr;
    } else if (node.type === 'function' && node.name?.name?.[0]?.value) {
      const funcName = node.name.name[0].value;
      if (funcName === 'EXISTS') {
        isExists = true;
        subqueryAst = node.args?.value?.[0]?.ast || node.args?.value?.[0];
      } else if (funcName === 'NOT EXISTS') {
        isNotExists = true;
        subqueryAst = node.args?.value?.[0]?.ast || node.args?.value?.[0];
      }
    }

    if (isExists || isNotExists) {
      if (subqueryAst?.type === 'select') {
        const previousContext = this.correlationContext;
        this.correlationContext = record;
        try {
          // Executa subquery com contexto de correlação do registro atual
          // Usa o contexto de CTE atual do engine (já armazenado em this.cteResults)
          // Nota: executeSelect aceita cteContext opcional; usamos o padrão interno
          // para manter compatibilidade
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let hasRows = false;
          try {
            const results = await this.executeSelect(
              subqueryAst as any,
              userId || '',
              this.cteResults,
            );
            hasRows = Array.isArray(results) && results.length > 0;
          } catch {
            // Em caso de erro na subquery (ex: tabela inexistente), tratar como conjunto vazio
            hasRows = false;
          }
          return isExists ? hasRows : !hasRows;
        } finally {
          this.correlationContext = previousContext;
        }
      }
      // If subquery is not a select, treat as empty result set
      return isExists ? false : true;
    }

    // IS NULL / IS NOT NULL
    if (node.operator === 'IS' || node.operator === 'IS NOT') {
      const left = this.evaluateWhereExpression(record, node.left);
      const isNull = left === null || left === undefined;
      return node.operator === 'IS' ? isNull : !isNull;
    }

    // Operadores lógicos (AND/OR)
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      const left = await this.evaluateWhereCondition(record, node.left, userId);
      const right = await this.evaluateWhereCondition(
        record,
        node.right,
        userId,
      );
      return node.operator === 'AND' ? left && right : left || right;
    }

    // IN / NOT IN (com subquery ou lista)
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'IN' || node.operator === 'NOT IN')
    ) {
      const fieldValue = this.evaluateWhereExpression(record, node.left);

      // Verificar se é subquery (pré-processado) ou lista literal
      if (node.right.__subquery_results) {
        // Subquery já executada
        const results = node.right.__subquery_results;
        const isIn = results.includes(fieldValue);
        return node.operator === 'IN' ? isIn : !isIn;
      } else if (node.right.type === 'expr_list') {
        // Lista literal
        const values = node.right.value.map((v: any) => this.extractValue(v));
        const isIn = values.includes(fieldValue);
        return node.operator === 'IN' ? isIn : !isIn;
      }
      return false;
    }

    // ANY / ALL como funções em comparações (ex: salary > ANY(...))
    if (node.type === 'binary_expr' && node.right?.type === 'function') {
      const funcName = node.right.name?.name?.[0]?.value;
      if (funcName === 'ANY' || funcName === 'ALL') {
        const leftValue = this.evaluateWhereExpression(record, node.left);
        const comparison = node.operator; // >, <, =, !=, etc

        // Resultados da subquery já pré-processados
        const args = node.right.args?.value?.[0];
        if (args?.__subquery_results) {
          const results = args.__subquery_results;

          if (funcName === 'ANY') {
            // True se comparação é verdadeira para ALGUM valor
            return results.some((val: any) =>
              this.compareValues(leftValue, val, comparison),
            );
          } else {
            // ALL: True se comparação é verdadeira para TODOS valores
            return results.every((val: any) =>
              this.compareValues(leftValue, val, comparison),
            );
          }
        }
      }
    }

    // Comparação
    if (node.type === 'binary_expr') {
      const left = this.evaluateWhereExpression(record, node.left);
      const right = this.evaluateWhereExpression(record, node.right);

      switch (node.operator) {
        case '=':
          return left == right;
        case '!=':
          return left != right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Compara dois valores com um operador
   */
  private compareValues(left: any, right: any, operator: string): boolean {
    switch (operator) {
      case '=':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      default:
        return false;
    }
  }

  /**
   * Avalia expressão no WHERE (coluna ou função)
   */
  private evaluateWhereExpression(record: any, node: any): any {
    if (!node) return null;

    // Função (ex: LENGTH(name))
    if (node.type === 'function') {
      return this.evaluateFunctionExpression(node, record);
    }

    // CAST(value AS type) - conversão de tipo
    if (node.type === 'cast') {
      const value = this.extractExpressionValue(node.expr, record);
      const targetTypeRaw = node.target?.[0]?.dataType || '';
      const targetType = String(targetTypeRaw).toUpperCase();
      return this.castValue(value, targetType);
    }

    // Mathematical expression (ex: team_a_sales + team_b_sales)
    if (node.type === 'binary_expr') {
      const arithmeticOps = ['+', '-', '*', '/', '%'];
      if (arithmeticOps.includes(node.operator)) {
        const left = this.evaluateWhereExpression(record, node.left);
        const right = this.evaluateWhereExpression(record, node.right);

        switch (node.operator) {
          case '+':
            return Number(left) + Number(right);
          case '-':
            return Number(left) - Number(right);
          case '*':
            return Number(left) * Number(right);
          case '/':
            return Number(left) / Number(right);
          case '%':
            return Number(left) % Number(right);
          default:
            return null;
        }
      }
    }

    // Coluna
    if (node.type === 'column_ref') {
      return this.extractExpressionValue(node, record);
    }

    // Valor literal
    return this.extractValue(node);
  }

  /**
   * Aplica filtros em registros
   */
  private applyFilters(records: any[], filterConfig: any): any[] {
    return records.filter((record) =>
      this.matchesFilters(record, filterConfig),
    );
  }

  /**
   * Verifica se um registro corresponde aos filtros
   */
  private matchesFilters(record: any, filterConfig: any): boolean {
    const { condition, rules } = filterConfig;

    if (condition === 'AND') {
      return rules.every((rule: any) => {
        if (rule.condition) {
          // Nested filter
          return this.matchesFilters(record, rule);
        }
        return this.matchesRule(record, rule);
      });
    } else {
      return rules.some((rule: any) => {
        if (rule.condition) {
          return this.matchesFilters(record, rule);
        }
        return this.matchesRule(record, rule);
      });
    }
  }

  /**
   * Verifica se um registro corresponde a uma regra
   */
  private matchesRule(record: any, rule: any): boolean {
    const { field, operator, value, caseInsensitive } = rule;
    let fieldValue = record[field];

    // Se case-insensitive, converter ambos os valores para lowercase
    let compareValue = value;
    if (
      caseInsensitive &&
      (operator === 'contains' ||
        operator === 'notContains' ||
        operator === 'startsWith' ||
        operator === 'endsWith' ||
        operator === 'equals' ||
        operator === 'notEquals')
    ) {
      fieldValue = String(fieldValue).toLowerCase();
      compareValue = String(value).toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'notEquals':
        return fieldValue !== compareValue;
      case 'greaterThan':
        return fieldValue > value;
      case 'greaterThanOrEqual':
        return fieldValue >= value;
      case 'lessThan':
        return fieldValue < value;
      case 'lessThanOrEqual':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'notContains':
        return !String(fieldValue).includes(String(compareValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(compareValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(compareValue));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'isNull':
        return fieldValue === null;
      case 'isNotNull':
        return fieldValue !== null;
      default:
        return false;
    }
  }

  /**
   * Extrai valor do AST
   */
  private extractValue(node: any): any {
    if (node.type === 'number') return Number(node.value);
    if (node.type === 'string' || node.type === 'single_quote_string')
      return String(node.value);
    if (node.type === 'bool') return Boolean(node.value);
    if (node.type === 'null') return null;
    if ('value' in node) return node.value;
    return null;
  }

  /**
   * Processa UNION, INTERSECT, EXCEPT e suas variações
   */
  private async processUnion(
    ast: any,
    userId: string,
    cteContext?: Map<string, any[]>,
  ): Promise<any[]> {
    const setOp = ast.set_op?.toLowerCase() || 'union';
    console.log(`🔗 [SQL-ENGINE] Processing ${setOp.toUpperCase()}`);

    let results: any[] = [];
    let encounteredUnionAll = false;
    let currentAst = ast;

    // Função auxiliar: cria uma chave canônica ignorando metacampos (ex: _id)
    const canonicalKey = (row: any): string => {
      if (!row || typeof row !== 'object') return JSON.stringify(row);
      const entries = Object.entries(row)
        .filter(([k]) => !k.startsWith('_'))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return JSON.stringify(entries);
    };

    // Descobrir ORDER BY e LIMIT global posicionado no último SELECT da cadeia (_next)
    let tail: any = ast;
    while (tail._next) tail = tail._next;
    const globalOrderBy = tail.orderby;
    const globalLimit = tail.limit;
    const globalOffset = tail.offset;
    // Evitar que ORDER BY, LIMIT, OFFSET do último SELECT seja aplicado individualmente
    if (globalOrderBy) {
      tail.orderby = null;
    }
    if (globalLimit) {
      tail.limit = null;
    }
    if (globalOffset) {
      tail.offset = null;
    }

    // Executar a primeira query
    const firstResults = await this.executeSingleSelect(
      currentAst,
      userId,
      cteContext,
    );
    results = [...firstResults];

    // Percorrer chain de set operations (ast._next)
    while (currentAst._next) {
      currentAst = currentAst._next;
      const nextResults = await this.executeSingleSelect(
        currentAst,
        userId,
        cteContext,
      );

      const currentOp = (currentAst.set_op || setOp).toLowerCase();

      if (currentOp === 'union all') {
        // UNION ALL: manter duplicatas
        results.push(...nextResults);
        encounteredUnionAll = true;
      } else if (currentOp === 'union') {
        // UNION: remover duplicatas
        for (const row of nextResults) {
          const key = canonicalKey(row);
          const isDuplicate = results.some(
            (existing) => canonicalKey(existing) === key,
          );
          if (!isDuplicate) {
            results.push(row);
          }
        }
      } else if (currentOp === 'intersect') {
        // INTERSECT: manter apenas linhas que existem em AMBOS
        const nextKeys = new Set(nextResults.map((r) => canonicalKey(r)));
        results = results.filter((row) => nextKeys.has(canonicalKey(row)));
      } else if (currentOp === 'except' || currentOp === 'minus') {
        // EXCEPT/MINUS: manter apenas linhas que NÃO existem na segunda query
        const nextKeys = new Set(nextResults.map((r) => canonicalKey(r)));
        results = results.filter((row) => !nextKeys.has(canonicalKey(row)));
      }
    }

    // Após concluir as operações de conjunto, remover duplicatas somente quando necessário
    // - INTERSECT e EXCEPT: sempre sem duplicatas
    // - UNION (distinct): já removido acima, mas dedupe é idempotente
    // - UNION ALL: NÃO deduplicar
    let deduped: any[] = results;
    if (!encounteredUnionAll) {
      const seen = new Set<string>();
      deduped = [];
      for (const row of results) {
        const key = canonicalKey(row);
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(row);
        }
      }
    }

    // Aplicar ORDER BY global (se houver)
    if (globalOrderBy) {
      deduped = this.applyOrderBy(deduped, globalOrderBy);
    }

    // Aplicar LIMIT e OFFSET global (se houver)
    if (globalLimit || globalOffset) {
      let limit: number | undefined;
      let offset = 0;

      if (globalLimit) {
        if (Array.isArray(globalLimit.value)) {
          limit = globalLimit.value[0].value;
          if (globalLimit.seperator === 'offset' && globalLimit.value[1]) {
            offset = globalLimit.value[1].value;
          }
        } else {
          limit = globalLimit.value || globalLimit;
        }
      }

      if (globalOffset) {
        offset = globalOffset.value || globalOffset;
      }

      if (limit !== undefined) {
        deduped = deduped.slice(offset, offset + limit);
      } else if (offset > 0) {
        deduped = deduped.slice(offset);
      }
    }

    return deduped;
  }

  /**
   * Executa um SELECT simples (sem UNION)
   */
  private async executeSingleSelect(
    ast: any,
    userId: string,
    cteContext?: Map<string, any[]>,
  ): Promise<any[]> {
    // Temporariamente remover _next para evitar recursão
    const originalNext = ast._next;
    ast._next = null;

    const results = await this.executeSelect(ast, userId, cteContext);

    // Restaurar _next
    ast._next = originalNext;

    return results;
  }
}

// Export instância padrão
export const sqlEngine = new SqlEngine();
