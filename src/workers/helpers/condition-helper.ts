/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WebhookJobData } from '@/services/queue';
import { replaceVariables } from './variable-replacer';

interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface ConditionRule {
  variable: string;
  operator: string;
  value?: string;
  logicOperator?: 'AND' | 'OR';
}

interface SwitchCase {
  id: string;
  label: string;
  variable?: string;
  operator?: string;
  value?: string;
  rules?: ConditionRule[];
}

interface ConditionConfig {
  conditionType: 'if' | 'switch';
  rules?: ConditionRule[];
  cases?: SwitchCase[];
  useDefaultCase?: boolean;
  memoryConfig?: any;
}

/**
 * Avalia uma condição individual baseada no operador
 *
 * Operadores suportados:
 * - equals, not_equals: Igualdade exata
 * - contains, not_contains: Substring
 * - starts_with, ends_with: Prefixo/sufixo
 * - greater_than, less_than, greater_or_equal, less_or_equal: Comparação numérica
 * - is_empty, is_not_empty: Verificação de string vazia
 * - regex_match: Correspondência com regex
 */
export function evaluateCondition(
  variable: string,
  operator: string,
  value: string,
): boolean {
  const varStr = String(variable || '').trim();
  const valStr = String(value || '').trim();

  switch (operator) {
    case 'equals':
      return varStr === valStr;

    case 'not_equals':
      return varStr !== valStr;

    case 'contains':
      return varStr.includes(valStr);

    case 'not_contains':
      return !varStr.includes(valStr);

    case 'starts_with':
      return varStr.startsWith(valStr);

    case 'ends_with':
      return varStr.endsWith(valStr);

    case 'greater_than': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum > valNum;
    }

    case 'less_than': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum < valNum;
    }

    case 'greater_or_equal': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum >= valNum;
    }

    case 'less_or_equal': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum <= valNum;
    }

    case 'is_empty':
      return varStr === '';

    case 'is_not_empty':
      return varStr !== '';

    case 'regex_match':
      try {
        const regex = new RegExp(valStr);
        return regex.test(varStr);
      } catch (error) {
        console.error(`❌ Invalid regex pattern: ${valStr}`, error);
        return false;
      }

    default:
      console.warn(`⚠️ Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Processa um nó de condição (Condition Node)
 *
 * Suporta dois tipos:
 * - IF: Avalia uma ou mais regras combinadas com AND/OR
 * - SWITCH: Avalia múltiplos casos e retorna o primeiro que der match
 */
export async function processConditionNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
  variableContext: any,
  processNodeMemory?: (
    config: any,
    execId: string,
    context: any,
  ) => Promise<any>,
): Promise<unknown> {
  console.log('🔀 Processing condition node');

  const conditionConfig = node.data?.conditionConfig as
    | ConditionConfig
    | undefined;

  console.log('🔍 Condition config:', JSON.stringify(conditionConfig, null, 2));

  if (!conditionConfig || !conditionConfig.conditionType) {
    throw new Error(
      'Condition node is not configured. Please double-click the node and configure it.',
    );
  }

  try {
    console.log('🔍 Condition variable context:', {
      hasLoop: !!variableContext.$loop,
      availableNodes: Object.keys(variableContext.$nodes),
    });

    // Processar baseado no tipo de condição
    if (conditionConfig.conditionType === 'if') {
      // Processar IF
      const rules = conditionConfig.rules || [];
      if (rules.length === 0) {
        throw new Error('No rules defined for IF condition');
      }

      console.log(`🔀 Evaluating ${rules.length} IF rule(s)`);

      // Avaliar cada regra
      const evaluationResults: boolean[] = [];
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const resolvedVariable = replaceVariables(
          rule.variable,
          variableContext,
        );
        const resolvedValue = replaceVariables(
          rule.value || '',
          variableContext,
        );

        const result = evaluateCondition(
          resolvedVariable,
          rule.operator,
          resolvedValue,
        );
        evaluationResults.push(result);

        console.log(
          `  Rule ${i + 1}: "${resolvedVariable}" ${rule.operator} "${resolvedValue}" = ${result}`,
        );
      }

      // Combinar resultados baseado em operadores lógicos
      let finalResult = evaluationResults[0];
      for (let i = 1; i < evaluationResults.length; i++) {
        const logicOperator = rules[i].logicOperator || 'AND';
        if (logicOperator === 'AND') {
          finalResult = finalResult && evaluationResults[i];
        } else {
          // OR
          finalResult = finalResult || evaluationResults[i];
        }
      }

      console.log(`🔀 Final IF result: ${finalResult}`);

      // Processar memória se configurada
      let memoryResult = undefined;
      if (conditionConfig.memoryConfig && processNodeMemory) {
        memoryResult = await processNodeMemory(
          conditionConfig.memoryConfig,
          executionId,
          variableContext,
        );
      }

      return {
        type: 'condition',
        conditionType: 'if',
        result: finalResult,
        selectedHandle: finalResult ? 'true' : 'false',
        evaluations: evaluationResults,
        memoryResult,
      };
    } else if (conditionConfig.conditionType === 'switch') {
      // Processar SWITCH
      const cases = conditionConfig.cases || [];
      if (cases.length === 0) {
        throw new Error('No cases defined for SWITCH condition');
      }

      console.log(`🔀 Evaluating SWITCH with ${cases.length} case(s)`);

      // Avaliar cada caso com suas múltiplas regras
      let matchedCase: SwitchCase | undefined;
      const evaluationResults: Array<{
        caseId: string;
        label: string;
        rules: Array<{
          variable: string;
          operator: string;
          value: string;
          result: boolean;
        }>;
        finalResult: boolean;
      }> = [];

      for (const caseItem of cases) {
        // Se o caso tem rules (novo formato), avaliar múltiplas regras
        if (caseItem.rules && caseItem.rules.length > 0) {
          const ruleResults: boolean[] = [];
          const ruleDetails: Array<{
            variable: string;
            operator: string;
            value: string;
            result: boolean;
          }> = [];

          // Avaliar cada regra do caso
          for (const rule of caseItem.rules) {
            const resolvedVariable = replaceVariables(
              rule.variable,
              variableContext,
            );
            const resolvedValue = replaceVariables(
              rule.value || '',
              variableContext,
            );

            const result = evaluateCondition(
              resolvedVariable,
              rule.operator,
              resolvedValue,
            );

            ruleResults.push(result);
            ruleDetails.push({
              variable: resolvedVariable,
              operator: rule.operator,
              value: resolvedValue,
              result,
            });

            console.log(
              `    Rule: "${resolvedVariable}" ${rule.operator} "${resolvedValue}" = ${result}`,
            );
          }

          // Aplicar operadores lógicos entre as regras
          let finalResult = ruleResults[0];
          for (let i = 0; i < caseItem.rules.length - 1; i++) {
            const rule = caseItem.rules[i];
            if (rule.logicOperator === 'AND') {
              finalResult = finalResult && ruleResults[i + 1];
            } else if (rule.logicOperator === 'OR') {
              finalResult = finalResult || ruleResults[i + 1];
            }
          }

          evaluationResults.push({
            caseId: caseItem.id,
            label: caseItem.label,
            rules: ruleDetails,
            finalResult,
          });

          console.log(`  Case "${caseItem.label}": ${finalResult}`);

          // Primeiro caso que der match é selecionado
          if (!matchedCase && finalResult) {
            matchedCase = caseItem;
          }
        } else {
          // Formato antigo (compatibilidade): avaliar com variable, operator, value
          const resolvedVariable = replaceVariables(
            caseItem.variable || '',
            variableContext,
          );
          const resolvedValue = replaceVariables(
            caseItem.value || '',
            variableContext,
          );

          const result = evaluateCondition(
            resolvedVariable,
            caseItem.operator || 'equals',
            resolvedValue,
          );

          evaluationResults.push({
            caseId: caseItem.id,
            label: caseItem.label,
            rules: [
              {
                variable: resolvedVariable,
                operator: caseItem.operator || 'equals',
                value: resolvedValue,
                result,
              },
            ],
            finalResult: result,
          });

          console.log(
            `  Case "${caseItem.label}": "${resolvedVariable}" ${caseItem.operator} "${resolvedValue}" = ${result}`,
          );

          // Primeiro caso que der match é selecionado
          if (!matchedCase && result) {
            matchedCase = caseItem;
          }
        }
      }

      let selectedHandle: string;
      if (matchedCase) {
        selectedHandle = `case_${matchedCase.id}`;
        console.log(
          `🔀 Matched case: "${matchedCase.label}" (ID: ${matchedCase.id})`,
        );
      } else if (conditionConfig.useDefaultCase !== false) {
        selectedHandle = 'default';
        console.log(`🔀 No match found, using DEFAULT case`);
      } else {
        throw new Error(`No matching case found and no default case defined`);
      }

      // Processar memória se configurada
      let memoryResult = undefined;
      if (conditionConfig.memoryConfig && processNodeMemory) {
        memoryResult = await processNodeMemory(
          conditionConfig.memoryConfig,
          executionId,
          variableContext,
        );
      }

      return {
        type: 'condition',
        conditionType: 'switch',
        matchedCase: matchedCase?.label,
        selectedHandle,
        totalCases: cases.length,
        evaluations: evaluationResults,
        memoryResult,
      };
    } else {
      throw new Error(
        `Unknown condition type: ${conditionConfig.conditionType}`,
      );
    }
  } catch (error) {
    console.error(`❌ Error processing condition node:`, error);
    throw error;
  }
}
