// ============================================
// FILTER TRANSLATOR - SQL WHERE → FilterConfig
// ============================================

import type {
  FilterConfig,
  FilterRule,
  FilterOperator,
} from '@/services/database/database.types';

export class FilterTranslator {
  /**
   * Converte cláusula WHERE do AST para FilterConfig
   */
  translateToFilterConfig(whereClause: any): FilterConfig {
    if (!whereClause) {
      return { condition: 'AND', rules: [] };
    }

    return this.processCondition(whereClause);
  }

  /**
   * Processa uma condição (AND/OR/comparação)
   */
  private processCondition(node: any): FilterConfig {
    // Condições lógicas (AND/OR)
    if (
      node.type === 'binary_expr' &&
      (node.operator === 'AND' || node.operator === 'OR')
    ) {
      const leftFilter = this.processCondition(node.left);
      const rightFilter = this.processCondition(node.right);

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
  private translateComparison(node: any): FilterRule {
    const field = this.extractFieldName(node.left);
    const value = this.extractValue(node.right);
    const operator = this.translateOperator(node.operator);

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
  private translateInOperator(node: any): FilterConfig {
    // node deve ser: { left: { column }, right: { type: 'expr_list', value: [...] } }
    const parent = node; // O node já contém left e right
    const field = this.extractFieldName(parent.left);
    const values = parent.right.value.map((v: any) => this.extractValue(v));
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
  private translateNullCheck(node: any): FilterRule {
    const field = this.extractFieldName(node.left);
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
  private translateLike(node: any): FilterRule {
    const field = this.extractFieldName(node.left);
    let value = this.extractValue(node.right);

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
      } as any;
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
  private translateBetween(node: any): FilterConfig {
    const field = this.extractFieldName(node.left);
    const minValue = this.extractValue(node.right.value[0]);
    const maxValue = this.extractValue(node.right.value[1]);

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
  private extractFieldName(node: any): string {
    if (!node) return '';

    // Função de agregação (ex: SUM(amount), COUNT(*), AVG(value))
    // No HAVING, essas já foram calculadas e estão disponíveis como campos no record
    if (node.type === 'aggr_func') {
      const func = node.name.toUpperCase();
      let field: string | undefined;

      // Extrair nome do campo da agregação
      if (node.args?.expr?.column) {
        field = node.args.expr.column;
      } else if (node.args?.value?.[0]?.column) {
        field = node.args.value[0].column;
      } else if (node.args?.expr?.type === 'star') {
        field = undefined; // COUNT(*)
      }

      // Retornar no formato padrão usado pelo AggregationProcessor
      return field ? `${func}(${field})` : `${func}(*)`;
    }

    if (node.type === 'column_ref') {
      // Pode ser: { column: 'name' } ou { table: 'users', column: 'name' }
      const column = node.column;
      if (typeof column === 'string') return column;
      if (column && typeof column === 'object' && column.expr) {
        return column.expr.value || '';
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
  private extractValue(node: any): any {
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
