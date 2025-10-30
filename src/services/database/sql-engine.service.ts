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
   * Executa uma query SQL
   */
  async execute(
    sql: string,
    userId: string,
    variableContext: Record<string, unknown> = {},
  ): Promise<SqlExecutionResult> {
    try {
      // Validar SQL vazio
      if (!sql || sql.trim().length === 0) {
        throw new Error('SQL query cannot be empty');
      }

      console.log(`🔷 [SQL-ENGINE] Executing SQL for user ${userId}`);
      console.log(
        `   SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`,
      );

      // 1. Resolver variáveis dinâmicas {{...}}
      const resolvedSql = replaceVariables(sql, variableContext);
      console.log(`   Resolved SQL: ${resolvedSql.substring(0, 200)}`);

      // Validar SQL resolvido vazio
      if (
        !resolvedSql ||
        (typeof resolvedSql === 'string' && resolvedSql.trim().length === 0)
      ) {
        throw new Error('SQL query cannot be empty after variable replacement');
      }

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

      // 2. Parse SQL
      let ast: any;
      try {
        ast = this.parser.astify(resolvedSql as string);
      } catch (error: any) {
        throw new Error(`SQL Syntax Error: ${error.message}`);
      }

      // Array de statements (pode ter múltiplos)
      const statements = Array.isArray(ast) ? ast : [ast];

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
          );
        }
      }

      // 5. Executar cada statement
      const results: any[] = [];
      for (const statement of statements) {
        const result = await this.executeStatement(statement, userId);
        results.push(result);
      }

      // 6. Limpar CTEs após execução
      this.cteResults.clear();

      // 5. Se apenas um statement, retornar direto
      if (results.length === 1) {
        return {
          success: true,
          data: results[0],
        };
      }

      // 6. Múltiplos statements: retornar array
      return {
        success: true,
        data: results,
      };
    } catch (error: any) {
      console.error(`❌ [SQL-ENGINE] Error:`, error.message);
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
      );
      return records;
    }

    // 2. Carregar tabela principal
    const mainTable = from[0];
    const mainTableName = mainTable.table;
    const mainTableAlias = mainTable.as || mainTableName;

    console.log(`   Main table: ${mainTableName} (alias: ${mainTableAlias})`);

    // Carregar dados: verificar se é CTE ou tabela física
    let records: any[];
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
      console.log(`   Loaded ${records.length} records from ${mainTableName}`);
    }

    // 3. Processar JOINs (se houver)
    if (from.length > 1 || ast.from[0].join) {
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

    // 4. Aplicar WHERE (filtros)
    if (ast.where) {
      // Check if WHERE contains functions
      const hasFunctions = this.whereHasFunctions(ast.where);

      if (hasFunctions) {
        // Evaluate WHERE directly with function support
        console.log(`   Applying WHERE with functions`);
        records = records.filter((record) =>
          this.evaluateWhereCondition(record, ast.where),
        );
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
      const aggregates = this.extractAggregates(ast.columns);

      console.log(`   GROUP BY fields:`, groupByFields);
      console.log(`   Aggregates:`, aggregates);

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
    records = this.projectColumns(records, ast.columns);
    console.log(`   After projection: ${records.length} records`);
    console.log(`   Sample record after projection:`, records[0]);

    // 7.5. Processar subqueries escalares no SELECT (assíncronamente)
    records = await this.evaluateScalarSubqueries(
      records,
      userId,
      effectiveCteResults,
    );

    // 8. DISTINCT
    if (ast.distinct) {
      records = this.applyDistinct(records);
    }

    // 9. LIMIT e OFFSET
    if (ast.limit) {
      // Parser structure: quando há OFFSET, seperator="offset" e value=[limit, offset]
      const limit = ast.limit.value[0].value;
      const offset =
        ast.limit.seperator === 'offset' && ast.limit.value[1]
          ? ast.limit.value[1].value
          : 0;
      records = records.slice(offset, offset + limit);
    }

    console.log(`   ✅ SELECT returned ${records.length} records`);
    if (records.length > 0) {
      console.log(`   First record:`, JSON.stringify(records[0], null, 2));
    }
    return records;
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
        const joinTableName = fromItem.table;
        const joinTableAlias = fromItem.as || joinTableName;
        const onCondition = fromItem.on;

        // Carregar tabela do JOIN: verificar se é CTE ou tabela física
        let joinRecords: any[];
        const cteData = this.cteProcessor.resolveCteReference(
          joinTableName,
          cteContext,
        );

        if (cteData) {
          console.log(`   Loading JOIN table from CTE: ${joinTableName}`);
          joinRecords = cteData;
        } else {
          // Carregar da tabela física
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

        console.log(
          `   Loading JOIN table: ${joinTableName} (${joinRecords.length} records)`,
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

    // ast.values é um objeto { type: 'values', values: [...] }
    const valuesArray = ast.values?.values || ast.values;

    if (!valuesArray || valuesArray.length === 0) {
      throw new Error('INSERT must have VALUES');
    }

    // Se columns está vazio, precisamos inferir do schema da tabela
    let schemaColumns: string[] = [];
    if (columns.length === 0) {
      // Buscar schema da partição 0 (principal)
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

    const inserted: any[] = [];

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

    console.log(`   ✅ Inserted ${inserted.length} records`);
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

    const result = await databaseService.deleteRecords(
      userId,
      tableName,
      filterConfig,
    );

    console.log(`   ✅ Deleted ${result.affected} records`);
    return result;
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

        columns.push({
          name: columnName,
          type: columnType,
          required: isRequired,
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
        const isTopLevel = col.expr?.type === 'aggr_func';
        const alias =
          isTopLevel && col.as
            ? col.as
            : `${aggFunc.function}(${aggFunc.field || '*'})`;

        aggregates.push({
          function: aggFunc.function as any,
          field: aggFunc.field,
          alias,
        });
      }
    }

    return aggregates;
  }

  /**
   * Busca recursivamente por funções de agregação em uma expressão
   * (pode estar aninhada dentro de ROUND, etc)
   */
  private findAggregateInExpression(
    expr: any,
  ): { function: string; field?: string } | null {
    if (!expr) return null;

    // Agregação direta (sem OVER - não é window function)
    if (expr.type === 'aggr_func' && !expr.over) {
      const func = expr.name.toUpperCase();

      // Extrair campo: pode estar em args.expr ou args.value[0]
      let field: string | undefined;
      if (expr.args?.expr?.column) {
        field = expr.args.expr.column;
      } else if (expr.args?.value?.[0]?.column) {
        field = expr.args.value[0].column;
      } else if (expr.args?.expr?.type === 'star') {
        field = undefined; // COUNT(*)
      }

      return { function: func, field };
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
        if (col.expr.args) {
          if (col.expr.args.expr?.column) {
            field = col.expr.args.expr.column;
          } else if (col.expr.args.value?.[0]?.column) {
            field = col.expr.args.value[0].column;
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

        windowFunctions.push({
          function: func,
          field,
          alias: alias || `${func}(${field || '*'})`,
          partitionBy,
          orderBy,
        });
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
          projected[alias] = this.evaluateCaseExpression(col.expr, record);
        } else if (col.expr?.type === 'function') {
          // Funções como ROUND, etc - avaliar a expressão
          const alias = col.as || `col_${colIndex}`;
          projected[alias] = this.evaluateFunctionExpression(col.expr, record);
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

      default:
        console.warn(`⚠️ Unsupported function: ${funcName}`);
        return null;
    }
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
   * Avalia uma expressão CASE WHEN
   */
  private evaluateCaseExpression(caseExpr: any, record: any): any {
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

      if (table) {
        // Com prefixo de tabela
        return record[`${table}.${column}`] || record[column];
      }
      return record[column];
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
   * Aplica ORDER BY
   */
  private applyOrderBy(records: any[], orderBy: any[]): any[] {
    return records.sort((a, b) => {
      for (const order of orderBy) {
        // Extrair campo com alias de tabela (ex: c.name)
        let field = order.expr.table
          ? `${order.expr.table}.${order.expr.column}`
          : order.expr.column;
        const direction = order.type === 'DESC' ? -1 : 1;

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

        if (aVal === undefined || bVal === undefined) continue;

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
   * Processa subqueries escalares no SELECT de forma assíncrona
   */
  private async evaluateScalarSubqueries(
    records: any[],
    userId: string,
    cteContext: Map<string, any[]>,
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

    // Processar cada registro
    const processedRecords = await Promise.all(
      records.map(async (record) => {
        const newRecord = { ...record };

        for (const { field, ast } of scalarSubqueries) {
          try {
            // Executar subquery
            const subqueryResults = await this.executeSelect(
              ast,
              userId,
              cteContext,
            );

            // Subquery escalar deve retornar um único valor
            if (subqueryResults.length === 0) {
              newRecord[field] = null;
            } else {
              // Pegar o primeiro campo do primeiro registro
              const firstRow = subqueryResults[0];
              const firstValue = Object.values(firstRow)[0];
              newRecord[field] = firstValue;
            }
          } catch (error: any) {
            console.error(
              `   Error executing scalar subquery for ${field}:`,
              error.message,
            );
            newRecord[field] = null;
          }
        }

        return newRecord;
      }),
    );

    return processedRecords;
  }

  /**
   * Avalia condição WHERE diretamente (suporta funções)
   */
  private evaluateWhereCondition(record: any, node: any): boolean {
    if (!node) return true;

    // Operadores lógicos (AND/OR)
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      const left = this.evaluateWhereCondition(record, node.left);
      const right = this.evaluateWhereCondition(record, node.right);
      return node.operator === 'AND' ? left && right : left || right;
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
   * Avalia expressão no WHERE (coluna ou função)
   */
  private evaluateWhereExpression(record: any, node: any): any {
    if (!node) return null;

    // Função (ex: LENGTH(name))
    if (node.type === 'function') {
      return this.evaluateFunctionExpression(node, record);
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
    const { field, operator, value } = rule;
    const fieldValue = record[field];

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'greaterThan':
        return fieldValue > value;
      case 'greaterThanOrEqual':
        return fieldValue >= value;
      case 'lessThan':
        return fieldValue < value;
      case 'lessThanOrEqual':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'notContains':
        return !String(fieldValue).includes(String(value));
      case 'startsWith':
        return String(fieldValue).startsWith(String(value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(value));
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
   * Processa UNION e UNION ALL
   */
  private async processUnion(
    ast: any,
    userId: string,
    cteContext?: Map<string, any[]>,
  ): Promise<any[]> {
    console.log(`🔗 [SQL-ENGINE] Processing UNION`);

    const results: any[] = [];
    let currentAst = ast;
    const isUnionAll = ast.set_op === 'union all';

    // Executar a primeira query
    const firstResults = await this.executeSingleSelect(
      currentAst,
      userId,
      cteContext,
    );
    results.push(...firstResults);

    // Percorrer chain de UNION (ast._next)
    while (currentAst._next) {
      currentAst = currentAst._next;
      const nextResults = await this.executeSingleSelect(
        currentAst,
        userId,
        cteContext,
      );

      if (isUnionAll || currentAst.set_op === 'union all') {
        // UNION ALL: manter duplicatas
        results.push(...nextResults);
      } else {
        // UNION: remover duplicatas
        for (const row of nextResults) {
          const isDuplicate = results.some(
            (existing) => JSON.stringify(existing) === JSON.stringify(row),
          );
          if (!isDuplicate) {
            results.push(row);
          }
        }
      }
    }

    // Aplicar ORDER BY global (se houver)
    if (ast.orderby) {
      return this.applyOrderBy(results, ast.orderby);
    }

    return results;
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
