// ============================================
// FILTER TRANSLATOR - SQL WHERE → FilterConfig
// ============================================

import type {
  FilterConfig,
  FilterRule,
  FilterOperator,
} from '@/services/database/database.types';

type ASTNode = Record<string, unknown>;

export class FilterTranslator {
  /**
   * Converte cláusula WHERE do AST para FilterConfig
   */
  translateToFilterConfig(
    whereClause: ASTNode | null | undefined,
  ): FilterConfig {
    if (!whereClause) {
      return { condition: 'AND', rules: [] };
    }

    return this.processCondition(whereClause);
  }

  /**
   * Processa uma condição (AND/OR/comparação)
   */
  private processCondition(node: ASTNode): FilterConfig {
    // Condições lógicas (AND/OR)
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      const leftFilter = this.processCondition(node.left as ASTNode);
      const rightFilter = this.processCondition(node.right as ASTNode);

      // Flatten se mesmo operador
      if (
        leftFilter.condition === node.operator &&
        rightFilter.condition === node.operator
      ) {
        return {
          condition: node.operator,
          rules: [...leftFilter.rules, ...rightFilter.rules],
        };
      }

      // Converter para nested rules
      return {
        condition: node.operator,
        rules: [leftFilter, rightFilter],
      };
    }

    // IN / NOT IN (verificar ANTES de binary_expr genérico)
    if (node.operator === 'IN' || node.operator === 'NOT IN') {
      return this.translateInOperator(node);
    }

    // IS NULL / IS NOT NULL (verificar ANTES de binary_expr genérico)
    if (node.operator === 'IS' || node.operator === 'IS NOT') {
      const rule = this.translateNullCheck(node);
      return {
        condition: 'AND',
        rules: [rule],
      };
    }

    // LIKE / NOT LIKE / ILIKE / NOT ILIKE (verificar ANTES de binary_expr genérico)
    if (
      node.operator === 'LIKE' ||
      node.operator === 'NOT LIKE' ||
      node.operator === 'ILIKE' ||
      node.operator === 'NOT ILIKE'
    ) {
      const rule = this.translateLike(node);
      return {
        condition: 'AND',
        rules: [rule],
      };
    }

    // BETWEEN / NOT BETWEEN (verificar ANTES de binary_expr genérico)
    if (node.operator === 'BETWEEN' || node.operator === 'NOT BETWEEN') {
      return this.translateBetween(node);
    }

    // Comparações simples (=, !=, >, <, >=, <=)
    if (node.type === 'binary_expr') {
      const rule = this.translateComparison(node);
      return {
        condition: 'AND',
        rules: [rule],
      };
    }

    // Fallback: tentar extrair campo e valor
    console.warn('⚠️ Unknown WHERE clause type:', node);
    return { condition: 'AND', rules: [] };
  }

  /**
   * Traduz comparação simples (=, !=, >, <, >=, <=)
   */
  private translateComparison(node: ASTNode): FilterRule {
    const field = this.extractFieldName(node.left as ASTNode);
    const value = this.extractValue(node.right as ASTNode);
    const operator = this.translateOperator(String(node.operator || ''));

    return {
      field,
      operator: operator as FilterOperator,
      value,
    };
  }

  /**
   * Traduz operador SQL para operador do DatabaseService
   */
  private translateOperator(sqlOperator: string): string {
    const operatorMap: Record<string, string> = {
      '=': 'equals',
      '!=': 'notEquals',
      '<>': 'notEquals',
      '>': 'greaterThan',
      '>=': 'greaterThanOrEqual',
      '<': 'lessThan',
      '<=': 'lessThanOrEqual',
    };

    return operatorMap[sqlOperator] || sqlOperator.toLowerCase();
  }

  /**
   * Traduz operador IN / NOT IN
   */
  private translateInOperator(node: ASTNode): FilterConfig {
    // node deve ser: { left: { column }, right: { type: 'expr_list', value: [...] } }
    const parent = node; // O node já contém left e right
    const field = this.extractFieldName(parent.left as ASTNode);
    const rightValue = parent.right as { value?: unknown[] };
    const values = (rightValue.value || []).map((v) =>
      this.extractValue(v as ASTNode),
    );
    const operator = parent.operator === 'IN' ? 'in' : 'notIn';

    return {
      condition: 'AND',
      rules: [
        {
          field,
          operator,
          value: values,
        },
      ],
    };
  }

  /**
   * Traduz IS NULL / IS NOT NULL
   */
  private translateNullCheck(node: ASTNode): FilterRule {
    const field = this.extractFieldName(node.left as ASTNode);
    const operator = node.operator === 'IS' ? 'isNull' : 'isNotNull';

    return {
      field,
      operator,
      value: null,
    };
  }

  /**
   * Traduz LIKE / NOT LIKE / ILIKE / NOT ILIKE
   */
  private translateLike(node: ASTNode): FilterRule {
    const field = this.extractFieldName(node.left as ASTNode);
    const value = this.extractValue(node.right as ASTNode);

    // Converter wildcards SQL (%) para string simples
    // LIKE 'test%' → contains 'test'
    // LIKE '%test' → endsWith 'test'
    // LIKE '%test%' → contains 'test'
    const likePattern = String(value);
    const isCaseInsensitive =
      node.operator === 'ILIKE' ||
      node.operator === 'NOT ILIKE' ||
      node._ilike === true;

    let operator: string;
    let cleanValue: string;

    if (likePattern.startsWith('%') && likePattern.endsWith('%')) {
      operator = 'contains';
      cleanValue = likePattern.slice(1, -1);
    } else if (likePattern.startsWith('%')) {
      operator = 'endsWith';
      cleanValue = likePattern.slice(1);
    } else if (likePattern.endsWith('%')) {
      operator = 'startsWith';
      cleanValue = likePattern.slice(0, -1);
    } else {
      // LIKE exato (sem wildcards) = equals
      operator = 'equals';
      cleanValue = likePattern;
    }

    // NOT LIKE/ILIKE inverte o operador
    if (node.operator === 'NOT LIKE' || node.operator === 'NOT ILIKE') {
      const notOperatorMap: Record<string, string> = {
        contains: 'notContains',
        startsWith: 'notContains', // Aproximação
        endsWith: 'notContains', // Aproximação
        equals: 'notEquals',
      };
      operator = notOperatorMap[operator] || 'notContains';
    }

    // Para case-insensitive, converter valor para lowercase
    // O DatabaseService.matchesRule precisa ser atualizado para suportar case-insensitive
    if (isCaseInsensitive) {
      cleanValue = cleanValue.toLowerCase();
      // Adicionar flag especial para indicar case-insensitive
      return {
        field,
        operator: operator as FilterOperator,
        value: cleanValue,
        caseInsensitive: true,
      } as FilterRule & { caseInsensitive?: boolean };
    }

    return {
      field,
      operator: operator as FilterOperator,
      value: cleanValue,
    };
  }

  /**
   * Traduz BETWEEN / NOT BETWEEN
   */
  private translateBetween(node: ASTNode): FilterConfig {
    const field = this.extractFieldName(node.left as ASTNode);
    const rightValue = node.right as { value?: unknown[] };
    const minValue = this.extractValue(
      (rightValue.value?.[0] || null) as ASTNode | null,
    );
    const maxValue = this.extractValue(
      (rightValue.value?.[1] || null) as ASTNode | null,
    );

    if (node.operator === 'BETWEEN') {
      // BETWEEN = (field >= min AND field <= max)
      return {
        condition: 'AND',
        rules: [
          {
            field,
            operator: 'greaterThanOrEqual',
            value: minValue,
          },
          {
            field,
            operator: 'lessThanOrEqual',
            value: maxValue,
          },
        ],
      };
    } else {
      // NOT BETWEEN = (field < min OR field > max)
      return {
        condition: 'OR',
        rules: [
          {
            field,
            operator: 'lessThan',
            value: minValue,
          },
          {
            field,
            operator: 'greaterThan',
            value: maxValue,
          },
        ],
      };
    }
  }

  /**
   * Extrai nome do campo do AST
   */
  private extractFieldName(node: ASTNode | null | undefined): string {
    if (!node) return '';

    // Função de agregação (ex: SUM(amount), COUNT(*), AVG(value))
    // No HAVING, essas já foram calculadas e estão disponíveis como campos no record
    if (node.type === 'aggr_func') {
      const func = String(node.name || '').toUpperCase();
      let field: string | undefined;

      // Extrair nome do campo da agregação
      // Type assertion: node.args pode ter expr ou value
      const args = node.args as
        | {
            expr?: { column?: string; type?: string };
            value?: Array<{ column?: string }>;
          }
        | undefined;

      if (args?.expr?.column) {
        field = args.expr.column;
      } else if (args?.value?.[0]?.column) {
        field = args.value[0].column;
      } else if (args?.expr?.type === 'star') {
        field = undefined; // COUNT(*)
      }

      // Retornar no formato padrão usado pelo AggregationProcessor
      return field ? `${func}(${field})` : `${func}(*)`;
    }

    if (node.type === 'column_ref') {
      // Pode ser: { column: 'name' } ou { table: 'users', column: 'name' }
      const column = node.column;
      if (typeof column === 'string') return column;
      if (column && typeof column === 'object') {
        // Type assertion: column pode ter expr
        const columnObj = column as { expr?: { value?: string } };
        if (columnObj.expr) {
          return columnObj.expr.value || '';
        }
      }
      // Formato alternativo do parser
      if (Array.isArray(column)) {
        return column[column.length - 1]; // Último item é o nome da coluna
      }
      return String(column);
    }

    if (node.column) {
      return String(node.column);
    }

    return '';
  }

  /**
   * Extrai valor do AST
   */
  private extractValue(node: ASTNode | null | undefined): unknown {
    if (!node) return null;

    // Valor direto
    if (node.type === 'number') {
      return Number(node.value);
    }

    if (node.type === 'string' || node.type === 'single_quote_string') {
      return String(node.value);
    }

    if (node.type === 'bool') {
      return Boolean(node.value);
    }

    if (node.type === 'null') {
      return null;
    }

    // Valor direto no campo value
    if ('value' in node) {
      return node.value;
    }

    return null;
  }
}
