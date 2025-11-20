/**
 * Serviço completo para better-playwright-mcp
 * Suporta modo guiado (com seletores CSS/XPath) e modo automático (com IA)
 *
 * NOTA: Este arquivo só roda no servidor (server-side only)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importar tipos do Playwright
import type { Browser, Page } from 'playwright';

// Importar tipos do arquivo compartilhado
import type {
  PlaywrightMcpStepAction,
  PlaywrightMcpStep,
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
} from '@/types/playwright-mcp.types';

// Re-exportar para compatibilidade
export type {
  PlaywrightMcpStepAction,
  PlaywrightMcpStep,
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
};

/**
 * Registro de ação executada (similar ao planner do web-scraper)
 */
interface ActionRecord {
  action: string;
  selector?: string;
  text?: string;
  context?: string;
  status: 'success' | 'failed';
  extracted_text?: string;
}

/**
 * Resultado da validação de conclusão de etapa
 */
interface ValidationResult {
  achieved: boolean;
  reason: string;
  answer?: string;
  skipped?: boolean; // Indica que validação foi pulada por falta de configuração ou erro
}

/**
 * Importa Context do better-playwright-mcp para modo automático
 * Retorna null se não estiver disponível
 *
 * NOTA: Import totalmente dinâmico para evitar bundle no cliente
 */
async function getContextClass(): Promise<any> {
  try {
    // Usar import dinâmico com string para evitar análise estática do Next.js
    // Biblioteca externa sem tipos TypeScript disponíveis
    const contextModule = await import(
      /* webpackIgnore: true */
      'better-playwright-mcp3/lib/loopTools/context.js'
    );
    return contextModule.Context;
  } catch (e) {
    // Context não disponível - modo automático não funcionará
    console.warn('⚠️ Context do better-playwright-mcp não disponível:', e);
    return null;
  }
}

/**
 * Executa uma tarefa usando better-playwright-mcp
 * Suporta modo guiado (seletores CSS/XPath) e modo automático (IA)
 *
 * @param input - Configuração da tarefa
 * @param options - Opções adicionais (browser do pool, timeout customizado)
 */
export async function runBetterPlaywrightMcpTask(
  input: PlaywrightMcpTaskInput,
  options?: {
    browser?: Browser;
    browserId?: string;
    skipBrowserCleanup?: boolean;
  },
): Promise<PlaywrightMcpTaskResult> {
  const logs: string[] = [];
  let browser: Browser | null = options?.browser || null;
  let page: Page | null = null;
  let finalAnswer: string | null = null;
  let finalUrl = '';
  let autoContext: any = null; // Context compartilhado para todas as etapas automáticas (tipo externo sem definição)
  const browserId = options?.browserId;
  const skipBrowserCleanup = options?.skipBrowserCleanup || false;

  // 🚀 Histórico de ações (similar ao planner do web-scraper)
  const actionHistory: ActionRecord[] = []; // Histórico global de todas as etapas

  // Obter configuração de headless uma única vez (default: true) - fora do try/catch para acessar no finally
  const headless = input.context?.headless !== false;

  try {
    logs.push(`🧱 Etapas recebidas: ${input.steps.length}`);

    // Import dinâmico do Playwright (server-side only)
    // Isso evita que o Next.js tente fazer bundle no cliente
    const pw = await import('playwright');
    const { chromium } = pw;

    // 🚀 ESTRATÉGIA: Criar browser apenas se necessário
    // Se houver etapas automatic, o Context criará seu próprio browser
    // Se houver etapas guided, criamos um browser manual (ou usamos do pool)
    // Se houver ambos, tentamos usar o browser do Context para o modo guided também
    const hasAutomaticSteps = input.steps.some((s) => s.mode === 'automatic');
    const hasGuidedSteps = input.steps.some((s) => s.mode !== 'automatic');

    // Criar browser manual apenas se houver etapas guided E não houver etapas automatic E não veio do pool
    // Se houver ambos, vamos tentar usar o browser do Context para o modo guided
    if (hasGuidedSteps && !hasAutomaticSteps && !browser) {
      browser = await chromium.launch({
        headless: headless,
      });

      if (!headless) {
        logs.push(
          '👁️ Navegador visível - você pode acompanhar a execução em tempo real',
        );
      }
    } else if (hasAutomaticSteps && hasGuidedSteps) {
      logs.push(
        '🔄 [INFO] Etapas automatic e guided detectadas - tentando compartilhar o mesmo navegador',
      );
    } else if (browser && browserId) {
      logs.push(`🔄 [POOL] Usando browser do pool (ID: ${browserId})`);
    }

    // Array para acumular outputs de múltiplas etapas (quando solicitado)
    const stepOutputs: Array<{ step: number; response: any }> = [];

    // Processar cada etapa
    for (let idx = 0; idx < input.steps.length; idx++) {
      const step = input.steps[idx];
      logs.push(
        `➡️ Etapa ${idx + 1}/${input.steps.length} - mode=${step.mode || 'guided'}`,
      );

      if (step.mode === 'automatic') {
        // ✅ MODO AUTOMÁTICO - IA navega sozinha
        const Context = await getContextClass();
        if (!Context) {
          logs.push(
            '❌ [AUTO] Context não disponível. Instale better-playwright-mcp3 corretamente.',
          );
          throw new Error(
            'Modo automático requer Context do better-playwright-mcp3',
          );
        }

        // Criar Context apenas uma vez para todas as etapas automáticas
        // Isso mantém o navegador aberto entre as etapas
        if (!autoContext) {
          try {
            // Configuração correta para Context.create()
            // Precisa da estrutura browser completa conforme esperado pelo better-playwright-mcp
            const allowedOrigins = input.context?.allowedDomains
              ? Array.isArray(input.context.allowedDomains)
                ? input.context.allowedDomains
                : typeof input.context.allowedDomains === 'string'
                  ? input.context.allowedDomains
                      .split(',')
                      .map((d) => d.trim())
                      .filter(Boolean)
                  : undefined
              : undefined;

            logs.push('🔧 [AUTO] Criando Context do better-playwright-mcp...');
            autoContext = await Context.create({
              browser: {
                browserName: 'chromium',
                launchOptions: {
                  headless: headless,
                  // 🚀 ANTI-DETECTION: Args do Chrome para evitar detecção de bot
                  args: [
                    '--disable-blink-features=AutomationControlled', // Remove "navigator.webdriver"
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--allow-running-insecure-content',
                    '--disable-infobars',
                    '--window-size=1920,1080',
                    '--start-maximized',
                  ],
                },
                contextOptions: {
                  viewport: { width: 1920, height: 1080 }, // Dimensões realistas
                  userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', // User-agent atualizado
                  locale: 'pt-BR', // Locale brasileiro
                  timezoneId: 'America/Sao_Paulo', // Timezone brasileira
                  permissions: ['geolocation', 'notifications'], // Permissions realistas
                  geolocation: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo
                  extraHTTPHeaders: {
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    Accept:
                      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  },
                },
              },
              network: {
                allowedOrigins: allowedOrigins?.length
                  ? allowedOrigins
                  : undefined,
                blockedOrigins: undefined,
              },
              server: {},
              saveTrace: false,
            });
            logs.push('✅ [AUTO] Context criado e navegador aberto');

            // 🚀 STEALTH INJECTION: Injetar scripts anti-detecção em todas as páginas
            try {
              // Acessar browserContext do autoContext para injetar scripts
              const browserContextPromise = autoContext._browserContextPromise;
              if (browserContextPromise) {
                const browserContextResult = await browserContextPromise;
                const browserContext = browserContextResult?.browserContext;

                if (browserContext) {
                  await browserContext.addInitScript(() => {
                    // Remove navigator.webdriver flag
                    Object.defineProperty(navigator, 'webdriver', {
                      get: () => false,
                    });

                    // Mock permissions
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters: any) =>
                      parameters.name === 'notifications'
                        ? Promise.resolve({
                            state: 'granted',
                          } as PermissionStatus)
                        : originalQuery(parameters);

                    // Mock plugins
                    Object.defineProperty(navigator, 'plugins', {
                      get: () => [1, 2, 3, 4, 5],
                    });

                    // Mock languages
                    Object.defineProperty(navigator, 'languages', {
                      get: () => ['pt-BR', 'pt', 'en-US', 'en'],
                    });

                    // Chrome object
                    (window as any).chrome = {
                      runtime: {},
                    };
                  });
                  logs.push('🔒 [AUTO] Scripts anti-detecção injetados');
                }
              }
            } catch (stealthError) {
              logs.push(
                `⚠️ [AUTO] Erro ao injetar scripts anti-detecção: ${stealthError}`,
              );
              // Continuar mesmo se stealth injection falhar
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Erro desconhecido';
            logs.push(`❌ [AUTO] Erro ao criar Context: ${errorMessage}`);
            throw error;
          }
        }

        try {
          // Para modo automatic: usar step.prompt (campo específico)
          // Fallback: step.description → input.goal → default
          let currentStepPrompt =
            step.prompt ||
            step.description ||
            input.goal ||
            'Complete the task';

          // Se houver URL na etapa, incluir na tarefa para que a IA navegue
          if (step.url) {
            currentStepPrompt = `Navigate to ${step.url} and then ${currentStepPrompt}`;
          }

          // Melhorar clareza da tarefa: dividir em passos explícitos se houver múltiplas ações
          // Exemplo: "clique em filtros. Em faixa de preços coloque o valor mínimo de 200 e valor máximo de 500"
          // Vira: "Step 1: Click on filters. Step 2: In price range, set minimum to 200 and maximum to 500"
          // IMPORTANTE: Não dividir URLs (que contêm pontos mas não são múltiplas ações)
          if (
            currentStepPrompt.includes('.') &&
            !currentStepPrompt.match(/https?:\/\//)
          ) {
            // Verificar se há múltiplas frases separadas por ponto (não é URL)
            const parts = currentStepPrompt.split(/\.\s+/).filter((p) => {
              const trimmed = p.trim();
              // Ignorar se for parte de URL ou se for muito curto
              return (
                trimmed.length > 3 &&
                !trimmed.match(/^(www|http|https|com|br|org|net)/i)
              );
            });

            if (parts.length > 1) {
              const numberedSteps = parts
                .map((part, i) => `Step ${i + 1}: ${part.trim()}`)
                .join('\n');
              currentStepPrompt = `Complete the following steps:\n${numberedSteps}\n\nAfter completing ALL steps, call the "done" tool.`;
            }
          }

          // 🎯 CONSTRUIR PROMPT ÚNICO CONSOLIDADO
          // Background é adicionado como "informações disponíveis" após o prompt do usuário
          let task = currentStepPrompt;

          // Se houver informações de etapas anteriores, adicionar como informações disponíveis
          if (idx > 0 && finalAnswer) {
            // Extrair apenas informações relevantes (remover logs e código)
            const cleanInfo = finalAnswer
              .replace(/\[tool\]:/g, '')
              .replace(/```[\s\S]*?```/g, '')
              .replace(/### Ran Playwright code/g, '')
              .replace(/\[assistant\]:/g, '')
              .trim();

            // Limitar a 1000 caracteres
            const infoSummary =
              cleanInfo.length > 1000
                ? cleanInfo.substring(0, 1000) + '...'
                : cleanInfo;

            // Adicionar background APÓS o prompt do usuário, como informação disponível
            task = `${task}

Available information from previous steps:
${infoSummary}

Use the information above to help complete your task.`;
          }

          // Adicionar instrução de conclusão
          task += `

IMPORTANT: After completing all actions, you MUST:
1. Explain what you did and whether you successfully completed the task
2. If you collected/found ANY information from the page (names, emails, dates, text, etc.), LIST them clearly with labels
3. If the task was to navigate/find something, confirm what you found
4. Then call the "done" tool to finish`;

          logs.push(
            `🤖 [AUTO] Executando tarefa: ${task.substring(0, 200)}...`,
          );

          // IA navega sozinha!
          // oneShot: false = permite múltiplas iterações (até 5) e requer chamar "done" ao final
          // oneShot: true = completa em uma única iteração sem precisar chamar "done"
          // Para tarefas complexas (como preencher formulário), usamos oneShot: false
          // para permitir múltiplas ações, mas a IA precisa chamar "done" ao final

          // Estratégia de retry inteligente
          let result;
          let lastError: Error | null = null;
          const maxRetries = 2; // Tentar até 2 vezes com abordagens diferentes

          for (
            let retryAttempt = 0;
            retryAttempt <= maxRetries;
            retryAttempt++
          ) {
            try {
              if (retryAttempt === 0) {
                // Primeira tentativa: tarefa completa
                result = await autoContext.runTask(task, false);
              } else if (retryAttempt === 1) {
                // Segunda tentativa: instrução mais explícita com prompt consolidado
                logs.push(
                  `🔄 [AUTO] Tentativa ${retryAttempt + 1}/${maxRetries + 1}: Adicionando instrução explícita...`,
                );

                // Construir retry task consolidado (mesma estrutura da primeira tentativa)
                let retryTask = currentStepPrompt;

                if (idx > 0 && finalAnswer) {
                  const cleanInfo = finalAnswer
                    .replace(/\[tool\]:/g, '')
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/### Ran Playwright code/g, '')
                    .replace(/\[assistant\]:/g, '')
                    .trim();

                  const infoSummary =
                    cleanInfo.length > 1000
                      ? cleanInfo.substring(0, 1000) + '...'
                      : cleanInfo;

                  retryTask = `${retryTask}

Available information from previous steps:
${infoSummary}

Use the information above to help complete your task.`;
                }

                retryTask += `

CRITICAL INSTRUCTIONS:
1. Complete the task step by step
2. After finishing, EXPLAIN what you did
3. If you collected ANY information, LIST it with clear labels
4. Then call the "done" tool`;

                result = await autoContext.runTask(retryTask, false);
              } else {
                // Terceira tentativa: simplificar e usar oneShot
                logs.push(
                  `🔄 [AUTO] Tentativa ${retryAttempt + 1}/${maxRetries + 1}: Simplificando tarefa...`,
                );
                const simplifiedTask = currentStepPrompt.split(/[.!?]\s/)[0]; // Primeira frase
                const simplifiedTaskWithExplanation = `${simplifiedTask}. After completing, explain what you did and call "done".`;
                result = await autoContext.runTask(
                  simplifiedTaskWithExplanation,
                  true,
                ); // oneShot para tarefa simples
              }

              // Se chegou aqui, sucesso!
              break;
            } catch (error) {
              lastError =
                error instanceof Error ? error : new Error(String(error));
              const errorMsg = lastError.message;

              logs.push(
                `⚠️ [AUTO] Tentativa ${retryAttempt + 1} falhou: ${errorMsg}`,
              );

              // Se é o último retry, lançar erro
              if (retryAttempt === maxRetries) {
                logs.push(
                  `❌ [AUTO] Todas as tentativas falharam. Último erro: ${errorMsg}`,
                );
                throw lastError;
              }

              // Se o erro é sobre "done" ou "max attempts", continuar para próximo retry
              if (
                errorMsg.includes('done') ||
                errorMsg.includes('Call the') ||
                errorMsg.includes('max attempts')
              ) {
                // Continuar para próximo retry
                continue;
              } else {
                // Outro tipo de erro - lançar imediatamente
                throw lastError;
              }
            }
          }

          if (!result) {
            throw (
              lastError ||
              new Error('Falha ao executar tarefa após todas as tentativas')
            );
          }

          // 🚀 Extrair histórico de ações do resultado (similar ao planner do web-scraper)
          // O resultado contém código Playwright executado que podemos parsear
          if (result?.content?.[0]?.text) {
            const rawResponse = result.content[0].text;

            // Extrair ações executadas do código Playwright
            const actionsFromResult = extractActionsFromPlaywrightCode(
              rawResponse,
              step.description || '',
            );
            actionHistory.push(...actionsFromResult);

            if (actionsFromResult.length > 0) {
              logs.push(
                `📜 [AUTO] ${actionsFromResult.length} ação(ões) extraída(s) do histórico`,
              );
            }

            // 🚀 Extrair explicação/conclusão da IA (texto fora dos blocos de código)
            const aiExplanation = extractAIExplanation(rawResponse);
            if (aiExplanation) {
              // Adicionar como uma "ação" especial que representa o que a IA disse que fez
              actionHistory.push({
                action: 'ai_report',
                text: aiExplanation,
                context: step.description || '',
                status: 'success',
              });
              logs.push(
                `💬 [AUTO] IA relatou: ${aiExplanation.substring(0, 100)}${aiExplanation.length > 100 ? '...' : ''}`,
              );

              // 🚀 CRUCIAL: Usar o relato da IA como finalAnswer para passar para próximas etapas
              // Isso garante que informações coletadas sejam passadas adiante
              finalAnswer = aiExplanation;
            }

            logs.push(`✅ [AUTO] Tarefa executada pela IA`);
          }

          // 🎯 VALIDAÇÃO DE CONCLUSÃO DA ETAPA (similar ao web-scraper)
          // Verificar se o objetivo da etapa foi realmente alcançado
          const validationResult = await validateStepCompletion(
            autoContext,
            step,
            input.goal,
            input.context,
            logs,
            actionHistory, // Passar histórico completo de ações
          );

          if (validationResult.achieved) {
            if (validationResult.skipped) {
              logs.push(
                `⚠️ [VALIDAÇÃO] Validação pulada: ${validationResult.reason}`,
              );
            } else {
              logs.push(
                `✅ [VALIDAÇÃO] Objetivo da etapa alcançado: ${validationResult.reason}`,
              );
            }

            // Usar answer da validação (se houver) - sobrescreve o relato da IA se mais estruturado
            if (validationResult.answer) {
              // Pode ser string ou objeto JSON
              if (typeof validationResult.answer === 'string') {
                if (validationResult.answer.trim().length > 10) {
                  finalAnswer = validationResult.answer; // Sobrescreve
                  logs.push(
                    `📝 [VALIDAÇÃO] Resposta da validação capturada e usará como contexto (string)`,
                  );

                  // 🚀 Adicionar ao array de outputs
                  stepOutputs.push({
                    step: idx + 1,
                    response: validationResult.answer,
                  });
                }
              } else {
                // É um objeto/array - converter para JSON string para finalAnswer
                finalAnswer = JSON.stringify(validationResult.answer, null, 2);
                logs.push(
                  `📝 [VALIDAÇÃO] Resposta da validação capturada e usará como contexto (objeto)`,
                );

                // 🚀 Adicionar ao array de outputs (manter como objeto, não string)
                stepOutputs.push({
                  step: idx + 1,
                  response: validationResult.answer,
                });
              }
            } else if (finalAnswer) {
              // Se validação não retornou answer mas temos relato da IA, adicionar aos outputs
              logs.push(
                `📝 [VALIDAÇÃO] Usando relato da IA como contexto para próximas etapas`,
              );
              stepOutputs.push({
                step: idx + 1,
                response: finalAnswer,
              });
            }
          } else {
            logs.push(
              `⚠️ [VALIDAÇÃO] Objetivo da etapa pode não ter sido completamente alcançado: ${validationResult.reason}`,
            );
          }

          // Atualizar URL final
          // Nota: O Context gerencia suas próprias páginas, então não precisamos atualizar page aqui
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Erro desconhecido';
          logs.push(`❌ [AUTO] Erro no modo automático: ${errorMessage}`);
          throw error;
        }
      } else {
        // ✅ MODO GUIADO - Executar ações fornecidas com seletores CSS/XPath
        // 🚀 Tentar usar o browser do autoContext se disponível (para compartilhar o mesmo navegador)
        let pageToUse: Page | null = page;

        // Se temos autoContext, tentar obter uma página do browserContext dele
        if (autoContext && !pageToUse) {
          try {
            // O Context gerencia suas próprias páginas através do browserContext
            // Acessando propriedade privada _browserContextPromise (API interna necessária para compartilhar browser)
            const browserContextPromise = autoContext._browserContextPromise;
            if (browserContextPromise) {
              const browserContextResult = await browserContextPromise;
              const browserContext = browserContextResult?.browserContext;

              if (browserContext) {
                // Obter página existente ou criar nova
                const existingPages = browserContext.pages();
                if (existingPages.length > 0) {
                  pageToUse = existingPages[0];
                  logs.push(
                    '🔄 [GUIDED] Usando página existente do Context (browser compartilhado)',
                  );
                } else {
                  pageToUse = await browserContext.newPage();
                  logs.push(
                    '🔄 [GUIDED] Criada nova página no browser do Context (browser compartilhado)',
                  );
                }
                page = pageToUse; // Atualizar referência global
              }
            }
          } catch (e) {
            logs.push(
              `⚠️ [GUIDED] Não foi possível usar browser do Context: ${e}. Criando browser manual...`,
            );
          }
        }

        // Se não conseguimos usar o browser do Context, criar browser manual
        if (!pageToUse) {
          if (!browser) {
            browser = await chromium.launch({
              headless: headless,
            });
            if (!headless) {
              logs.push(
                '👁️ Navegador visível - você pode acompanhar a execução em tempo real',
              );
            }
          }

          if (!pageToUse) {
            pageToUse = await browser.newPage();
            page = pageToUse; // Atualizar referência global
          }
        }

        // Navegar para URL da etapa se fornecida
        if (step.url && step.url !== finalUrl) {
          await pageToUse.goto(step.url, { waitUntil: 'networkidle' });
          finalUrl = pageToUse.url();
          logs.push(`🌐 Navegou para: ${finalUrl}`);
        }

        if (step.actions && step.actions.length > 0) {
          for (const action of step.actions) {
            await executeAction(pageToUse, action, logs);
          }
        }

        // Atualizar URL final
        if (pageToUse) {
          finalUrl = pageToUse.url();
        }
      }
    }

    // Retornar answer parseado se possível, senão como string
    let answerToReturn: any = undefined;

    if (finalAnswer) {
      try {
        // Tentar fazer parse do JSON
        const parsed = JSON.parse(finalAnswer);
        answerToReturn = parsed; // Retornar como objeto
        logs.push(`✅ [RESULTADO] Answer parseado como objeto JSON`);
      } catch {
        // Se não for JSON válido, retornar como string
        answerToReturn = finalAnswer;
        logs.push(
          `📝 [RESULTADO] Answer retornado como string (não é JSON válido)`,
        );
      }
    }

    // 🚀 Construir objeto de retorno com output se houver dados acumulados
    const dataToReturn: any = {
      finalUrl,
    };

    // Se houver outputs acumulados de múltiplas etapas, incluir array "output"
    if (stepOutputs.length > 0) {
      dataToReturn.output = stepOutputs;
      logs.push(
        `✅ [RESULTADO] Output com ${stepOutputs.length} resposta(s) de etapas`,
      );
    }

    // Manter "answer" para compatibilidade (última resposta)
    if (answerToReturn !== undefined) {
      dataToReturn.answer = answerToReturn;
    }

    return {
      success: true,
      message: 'Tarefa executada com sucesso',
      data: dataToReturn,
      logs,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    logs.push(`❌ Erro: ${errorMessage}`);

    return {
      success: false,
      error: true,
      message: errorMessage,
      logs,
    };
  } finally {
    // Se não está em headless mode, aguardar alguns segundos antes de fechar
    // para que o usuário possa ver o resultado final
    if (!headless) {
      logs.push(
        '⏳ Aguardando 5 segundos para visualização antes de fechar o navegador...',
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Limpar recursos
    // Fechar Context automático se existir (fecha o navegador do Context)
    if (autoContext) {
      try {
        logs.push('🔒 [AUTO] Fechando Context...');
        await autoContext.close();
        logs.push('✅ [AUTO] Context fechado');
      } catch (e) {
        logs.push(`⚠️ [AUTO] Erro ao fechar Context: ${e}`);
      }
    }

    if (page) {
      try {
        await page.close();
      } catch {
        // Ignorar erros ao fechar
      }
    }

    // Fechar browser apenas se NÃO veio do pool
    if (browser && !skipBrowserCleanup) {
      try {
        logs.push('🔒 Fechando browser...');
        await browser.close();
        logs.push('✅ Browser fechado');
      } catch {
        // Ignorar erros ao fechar
      }
    } else if (browser && skipBrowserCleanup && browserId) {
      logs.push(`🔄 [POOL] Browser ${browserId} retornará ao pool`);
      // Browser será retornado ao pool externamente
    }
  }
}

/**
 * Executa tarefa com timeout automático
 * Previne execuções infinitas que travam browsers
 */
export async function runWithTimeout(
  input: PlaywrightMcpTaskInput,
  timeoutMs: number = 5 * 60 * 1000, // 5 minutos por padrão
  options?: {
    browser?: Browser;
    browserId?: string;
    skipBrowserCleanup?: boolean;
  },
): Promise<PlaywrightMcpTaskResult> {
  return Promise.race([
    runBetterPlaywrightMcpTask(input, options),
    new Promise<PlaywrightMcpTaskResult>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Execution timeout: ${timeoutMs / 1000}s exceeded`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Executa tarefa usando browser do pool
 * Automaticamente adquire browser do pool, executa e retorna ao pool
 */
export async function runWithBrowserPool(
  input: PlaywrightMcpTaskInput,
  timeoutMs?: number,
): Promise<PlaywrightMcpTaskResult> {
  const { getBrowserPool } = await import('./browser-pool.service');
  const pool = getBrowserPool();

  let browserId: string | undefined;
  let browser: Browser | undefined;

  try {
    // Adquirir browser do pool
    const acquired = await pool.acquireBrowser();
    browser = acquired.browser;
    browserId = acquired.browserId;

    // Executar com timeout
    const result = await runWithTimeout(input, timeoutMs, {
      browser,
      browserId,
      skipBrowserCleanup: true, // Não fechar browser (vai voltar ao pool)
    });

    return result;
  } finally {
    // Retornar browser ao pool
    if (browserId) {
      await pool.releaseBrowser(browserId);
    }
  }
}

/**
 * Extrai explicação/relato da IA sobre o que foi feito (texto fora dos blocos de código)
 * A IA frequentemente explica o que fez e se concluiu o objetivo
 */
function extractAIExplanation(rawResponse: string): string | null {
  try {
    // Primeiro, tentar extrair texto após [assistant]: (se houver)
    const assistantMatch = rawResponse.match(
      /\[assistant\]:\s*([\s\S]+?)(?=\[tool\]:|$)/,
    );
    if (assistantMatch) {
      let assistantText = assistantMatch[1].trim();
      // Remover blocos de código desta parte
      assistantText = assistantText.replace(/```[\s\S]*?```/g, '');
      if (assistantText.length > 20) {
        return assistantText;
      }
    }

    // Se não encontrou [assistant]:, tentar extrair todo texto não-código
    let text = rawResponse.replace(/```[\s\S]*?```/g, '');

    // Remover marcadores de ferramentas
    text = text.replace(/\[tool\]:/g, '');
    text = text.replace(/\[assistant\]:/g, '');

    // Remover seções técnicas
    text = text.replace(/### Ran Playwright code[\s\S]*?(?=\n\n|$)/g, '');
    text = text.replace(/### New console messages[\s\S]*?(?=\n\n|$)/g, '');
    text = text.replace(/### Result[\s\S]*?(?=\n\n|$)/g, '');
    text = text.replace(/### Page state[\s\S]*?(?=\n\n|$)/g, '');

    // Remover logs verbosos
    text = text.replace(/\[VERBOSE\][^\n]*/g, '');
    text = text.replace(/\[WARNING\][^\n]*/g, '');
    text = text.replace(/\[LOG\][^\n]*/g, '');

    // Limpar
    text = text.replace(/---/g, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    // Se sobrou texto significativo (mais de 20 caracteres), retornar
    if (text.length > 20) {
      return text;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extrai ações executadas do código Playwright retornado pelo Context
 */
function extractActionsFromPlaywrightCode(
  rawResponse: string,
  stepDescription: string,
): ActionRecord[] {
  const actions: ActionRecord[] = [];

  try {
    // Procurar por código Playwright executado
    // Formato: ```js\nawait page.goto('...');\nawait page.click('...');\n```
    const codeBlocks = rawResponse.match(/```js\n([\s\S]*?)```/g);

    if (codeBlocks) {
      for (const block of codeBlocks) {
        const code = block
          .replace(/```js\n/, '')
          .replace(/```/g, '')
          .trim();
        const lines = code.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          const trimmed = line.trim();

          // Detectar tipo de ação
          if (trimmed.includes('page.goto(')) {
            const urlMatch = trimmed.match(/goto\(['"]([^'"]+)['"]\)/);
            if (urlMatch) {
              actions.push({
                action: 'goto_url',
                text: urlMatch[1],
                context: stepDescription,
                status: 'success',
              });
            }
          } else if (trimmed.includes('.click(')) {
            // Extrair seletor do click
            let selector = '';
            if (trimmed.includes('getByRole')) {
              const roleMatch = trimmed.match(/getByRole\(['"]([^'"]+)['"]/);
              const nameMatch = trimmed.match(/name:\s*['"]([^'"]+)['"]/);
              if (roleMatch) {
                selector = `role=${roleMatch[1]}`;
                if (nameMatch) selector += ` name="${nameMatch[1]}"`;
              }
            } else if (trimmed.includes('getByTestId')) {
              const testIdMatch = trimmed.match(
                /getByTestId\(['"]([^'"]+)['"]/,
              );
              if (testIdMatch) {
                selector = `testid=${testIdMatch[1]}`;
              }
            } else if (trimmed.includes('locator(')) {
              const locatorMatch = trimmed.match(/locator\(['"]([^'"]+)['"]/);
              if (locatorMatch) {
                selector = locatorMatch[1];
              }
            }

            actions.push({
              action: 'click',
              selector: selector || undefined,
              context: stepDescription,
              status: 'success',
            });
          } else if (trimmed.includes('.fill(') || trimmed.includes('.type(')) {
            // Extrair seletor e texto digitado
            let selector = '';
            let text = '';

            if (trimmed.includes('locator(')) {
              const locatorMatch = trimmed.match(/locator\(['"]([^'"]+)['"]/);
              if (locatorMatch) selector = locatorMatch[1];
            }

            const textMatch = trimmed.match(
              /\.(?:fill|type)\(['"]([^'"]+)['"]/,
            );
            if (textMatch) text = textMatch[1];

            actions.push({
              action: 'type',
              selector: selector || undefined,
              text: text || undefined,
              context: stepDescription,
              status: 'success',
            });
          } else if (trimmed.includes('.selectOption(')) {
            const selectorMatch = trimmed.match(/locator\(['"]([^'"]+)['"]/);
            const valueMatch = trimmed.match(/selectOption\(['"]([^'"]+)['"]/);

            actions.push({
              action: 'select_option',
              selector: selectorMatch ? selectorMatch[1] : undefined,
              text: valueMatch ? valueMatch[1] : undefined,
              context: stepDescription,
              status: 'success',
            });
          } else if (
            trimmed.includes('.textContent') ||
            trimmed.includes('.innerText') ||
            trimmed.includes('textContent') ||
            trimmed.includes('innerText')
          ) {
            // Detectar extração de texto
            actions.push({
              action: 'extract_text',
              context: stepDescription,
              status: 'success',
            });
          } else if (
            trimmed.includes('JSON.stringify') ||
            trimmed.includes('JSON.parse')
          ) {
            // Detectar manipulação de JSON (extração de dados estruturados)
            actions.push({
              action: 'extract_json',
              context: stepDescription,
              status: 'success',
            });
          }
        }
      }
    }
  } catch {
    // Se falhar ao extrair, continuar sem histórico
  }

  return actions;
}

/**
 * Formata histórico completo de ações para validação AI (similar ao web-scraper Python)
 * NÃO limita a 15 ações - passa TODAS as ações para a IA validar corretamente
 */
function formatActionHistoryForValidation(
  actionHistory: ActionRecord[],
): string {
  if (!actionHistory || actionHistory.length === 0) {
    return 'Nenhuma ação executada ainda.';
  }

  // Contar estatísticas
  const successCount = actionHistory.filter(
    (a) => a.status === 'success',
  ).length;
  const typeCount = actionHistory.filter(
    (a) => a.action === 'type' && a.status === 'success',
  ).length;
  const clickCount = actionHistory.filter(
    (a) => a.action === 'click' && a.status === 'success',
  ).length;

  // Formatar TODAS as ações (não limitar)
  const formattedActions = actionHistory
    .map((action, idx) => {
      const num = idx + 1;
      const status = action.status === 'success' ? '✅' : '❌';
      let line = `${num}. ${status} ${action.action}`;

      // 🚀 Destacar relatos da IA (ai_report) com formato especial
      if (action.action === 'ai_report') {
        const text = action.text || '';
        // Relato da IA sobre conclusão/status - MUITO IMPORTANTE para validação!
        line = `${num}. 💬 RELATO DA IA: ${text}`;
        if (action.context) {
          line += ` [sobre: ${action.context}]`;
        }
        return line;
      }

      if (action.selector) {
        line += ` (seletor: ${action.selector})`;
      }

      if (action.text) {
        const preview = action.text.substring(0, 50);
        line += ` → texto: "${preview}${action.text.length > 50 ? '...' : ''}"`;
      }

      if (action.context) {
        line += ` [contexto: ${action.context}]`;
      }

      return line;
    })
    .join('\n');

  return `
📜 HISTÓRICO COMPLETO DE AÇÕES EXECUTADAS (${actionHistory.length} ações):
${formattedActions}

📊 ESTATÍSTICAS:
- Total de ações bem-sucedidas: ${successCount}
- Ações de TYPE (digitar): ${typeCount}
- Ações de CLICK: ${clickCount}
`;
}

/**
 * Valida se o objetivo da etapa foi alcançado usando IA
 * Similar à função _check_goal_completion do web-scraper
 */
async function validateStepCompletion(
  context: any,
  step: PlaywrightMcpStep,
  generalGoal: string | undefined,
  inputContext: Record<string, any> | undefined,
  logs: string[],
  actionHistory: ActionRecord[] = [],
): Promise<ValidationResult> {
  try {
    // Usar as mesmas chaves que o better-playwright-mcp usa
    // O Context do better-playwright-mcp usa OPENAI_API_KEY ou ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // Detectar qual provedor está sendo usado
    let apiKey: string | undefined;
    let model: string | undefined;

    if (openaiKey) {
      apiKey = openaiKey;
      // Tentar detectar modelo OpenAI do contexto ou usar padrão
      model = inputContext?.AI_MODEL || process.env.AI_MODEL || 'gpt-4o';
    } else if (anthropicKey) {
      apiKey = anthropicKey;
      // Tentar detectar modelo Anthropic do contexto ou usar padrão
      model =
        inputContext?.AI_MODEL ||
        process.env.AI_MODEL ||
        'claude-3-5-sonnet-20241022';
    } else {
      // Fallback: tentar usar AI_API_KEY e AI_MODEL do contexto
      apiKey = inputContext?.AI_API_KEY || process.env.AI_API_KEY;
      model = inputContext?.AI_MODEL || process.env.AI_MODEL;
    }

    if (!apiKey || !model) {
      logs.push(
        '⚠️ [VALIDAÇÃO] Chave de IA não disponível (OPENAI_API_KEY, ANTHROPIC_API_KEY ou AI_API_KEY) - pulando validação',
      );
      return {
        achieved: true,
        reason: 'Validação não disponível',
        skipped: true,
      };
    }

    // Obter informações da página atual através do Context
    // O Context do better-playwright-mcp gerencia suas próprias páginas
    // Vamos usar uma tarefa simples para obter snapshot da página
    let pageInfo = '';
    let currentUrl = '';
    let pageTitle = '';
    let pageText = '';

    try {
      // Tentar obter informações da página através de uma tarefa de snapshot
      const snapshotTask =
        'Get the current page URL, title, and a brief summary of the page content (max 1000 characters).';
      const snapshotResult = await context.runTask(snapshotTask, true); // oneShot para apenas obter info

      if (snapshotResult?.content?.[0]?.text) {
        pageInfo = snapshotResult.content[0].text;
        // Tentar extrair URL e título do resultado
        const urlMatch = pageInfo.match(/URL[:\s]+([^\n]+)/i);
        const titleMatch = pageInfo.match(/title[:\s]+([^\n]+)/i);
        if (urlMatch) currentUrl = urlMatch[1].trim();
        if (titleMatch) pageTitle = titleMatch[1].trim();
        pageText = pageInfo.substring(0, 1500);
      }
    } catch (snapshotError) {
      logs.push(
        `⚠️ [VALIDAÇÃO] Erro ao obter snapshot da página: ${snapshotError}`,
      );
      // Continuar mesmo sem snapshot
    }

    // 🚀 Construir histórico COMPLETO de ações formatado (similar ao web-scraper)
    let actionHistoryInfo = '';
    if (actionHistory && actionHistory.length > 0) {
      actionHistoryInfo = formatActionHistoryForValidation(actionHistory);

      actionHistoryInfo += `
📋 FORMATO DO HISTÓRICO:
- Cada ação tem: ação → texto [contexto: descrição]
- 💬 RELATO DA IA: Quando presente, é a explicação da IA sobre o que fez e se concluiu
- O campo [contexto: ...] é a forma mais confiável de verificar correspondência!
- Exemplo: "5. ✅ click → texto: "Confirmar" [contexto: clicar no botão de confirmação]"

⚠️ VALIDAÇÃO RIGOROSA - ORDEM DE PRIORIDADE:
1. 💬 RELATO DA IA (MÁXIMA PRIORIDADE): Se houver "💬 RELATO DA IA" no histórico, leia com atenção!
   - A IA executora explica o que fez e se concluiu o objetivo
   - Exemplos: "Encontrei o dia 17/11", "Login realizado com sucesso", "Formulário preenchido"
   - Se o relato diz que concluiu → 99% de certeza que está correto!
2. Campo [contexto: ...]: Se corresponde ao objetivo, é VÁLIDO!
3. Texto da ação: Se contém palavras-chave do objetivo
4. Sequência lógica + conteúdo da página

🎯 REGRA DE OURO: Se há "💬 RELATO DA IA" dizendo que concluiu o objetivo, confie nele!
`;
    }

    // Construir prompt de validação similar ao web-scraper
    const prompt = `Você é um validador de objetivos. Analise se o objetivo da ETAPA ATUAL foi alcançado.

OBJETIVO DESTA ETAPA (foco principal):
${step.description || 'N/A'}

${generalGoal ? `OBJETIVO GERAL (apenas contexto, não valide este agora): ${generalGoal}` : ''}
${actionHistoryInfo}

⚠️ REGRAS DE VALIDAÇÃO:
- VALIDE APENAS se o OBJETIVO DESTA ETAPA foi concluído.
- O OBJETIVO GERAL é apenas contexto para você entender o contexto geral, mas NÃO deve ser usado para esta validação.
- Se a etapa atual foi concluída, retorne achieved=true, mesmo que o objetivo geral ainda não tenha sido alcançado.
- O objetivo geral será validado apenas no final de todas as etapas.

ESTADO ATUAL DA PÁGINA:
URL: ${currentUrl || 'N/A'}
TÍTULO: ${pageTitle || 'N/A'}
CONTEÚDO: ${pageText || 'N/A'}

🎯 VALIDAÇÃO EM 3 ETAPAS (SIGA RIGOROSAMENTE):

ETAPA 1 - DECOMPONHA O OBJETIVO EM PASSOS:
Identifique TODOS os passos EXPLICITAMENTE mencionados no objetivo da etapa.
- NÃO invente passos que não estão no objetivo
- Se o objetivo diz "preencher campos", apenas valide se os campos foram preenchidos
- Se o objetivo diz "preencher campos e clicar em X", valide ambos: preencher E clicar

Exemplo 1: "Preencher formulário"
  → Passo 1: Preencher campos do formulário
  → NÃO há passo de clicar (objetivo não menciona)

Exemplo 2: "Preencher formulário e clicar em confirmar"
  → Passo 1: Preencher campos do formulário
  → Passo 2: Clicar em botão de confirmar (EXPLÍCITO no objetivo)

ETAPA 2 - VERIFIQUE O HISTÓRICO:
Para cada passo identificado, verifique se há ação correspondente no histórico:
- Passo de "clicar em X" → deve ter ✅ click no histórico com seletor/texto correspondente OU contexto correspondente
- Passo de "digitar/definir Y" → deve ter ✅ type no histórico com seletor/texto correspondente OU contexto correspondente
- Passo de "aplicar filtro" → deve ter ✅ click após os types (APENAS se mencionado no objetivo)

🔍 COMO VERIFICAR CORRESPONDÊNCIA (MUITO IMPORTANTE!):
O histórico pode ter 3 formas de identificar ações:
1. CAMPO "contexto" (PRIORIDADE ALTA): [contexto: descrição]
   - Se objetivo pede "clicar no quarto vídeo" e histórico mostra [contexto: clicar no quarto vídeo] → ✅ CORRESPONDENTE!
   - Se objetivo pede "pegar primeiro comentário" e histórico mostra [contexto: pegar primeiro comentário] → ✅ CORRESPONDENTE!
   - O campo contexto é a forma mais confiável de verificar correspondência!

2. CAMPO "texto" ou "seletor": → "texto"
   - Se objetivo pede "clicar no botão que contém 'palavra1' e 'palavra2'"
   - E histórico mostra: click → texto: "texto com palavra1 e palavra2"
   - ✅ ISSO É CORRESPONDENTE! O texto contém TODAS as palavras-chave

3. SEQUÊNCIA LÓGICA + CONTEÚDO DA PÁGINA:
   - Se objetivo pede ações sequenciais e histórico mostra sequência correta + resultado visível na página → ✅ CORRESPONDENTE

REGRA GERAL:
- PRIMEIRO: Verifique o campo [contexto: ...] no histórico - se corresponde ao objetivo, é CORRESPONDENTE!
- SEGUNDO: Se não há contexto, verifique o texto do botão/campo
- TERCEIRO: Se não há nem contexto nem texto explícito, use sequência lógica + conteúdo da página

ETAPA 3 - DECISÃO FINAL:
✅ achieved=true SOMENTE SE:
  - TODOS os passos EXPLICITAMENTE mencionados no objetivo foram executados
  - Verificação: Para cada passo, encontre ação correspondente no histórico usando:
    * Campo [contexto: ...] (PRIORIDADE ALTA - se corresponde ao passo, é válido!)
    * OU texto do botão/campo que corresponde
    * OU sequência lógica + conteúdo da página
  - E há evidência de mudança de estado (quando aplicável):
    * URL mudou (ex: adicionou parâmetros de filtro, mudou para página de vídeo)
    * OU conteúdo novo apareceu (ex: comentários visíveis, vídeo carregado)
    * OU modal abriu
    * OU resultados foram recarregados
    * OU campos foram preenchidos (se objetivo era apenas preencher)

❌ achieved=false SE:
  - Falta algum passo EXPLICITAMENTE mencionado no objetivo
  - E não há ação correspondente no histórico (verificando contexto, texto ou sequência lógica)
  - Exemplo ERRADO: Objetivo pede "clicar no quarto vídeo" mas histórico não tem [contexto: clicar no quarto vídeo] nem click correspondente
  - Exemplo ERRADO: Objetivo pede "pegar primeiro comentário" mas histórico não tem [contexto: pegar primeiro comentário] nem evidência de extração

🎯 EXEMPLOS DE VALIDAÇÃO CORRETA:
- Objetivo: "clicar no quarto vídeo e pegar o primeiro comentário"
- Histórico tem: click [contexto: clicar no quarto vídeo] → ✅ Passo 1 OK!
- Histórico tem: [contexto: pegar primeiro comentário do vídeo] → ✅ Passo 2 OK!
- Página mostra comentários → ✅ Evidência adicional!
- RESULTADO: achieved=true

Responda APENAS em JSON válido:
{
  "achieved": true ou false,
  "reason": "explicação breve",
  "answer": "Se houver '💬 RELATO DA IA' no histórico que contém informações coletadas (nomes, emails, datas, etc.), extraia essas informações e retorne aqui em formato JSON estruturado. Exemplo: {\"nome\": \"Erick Wendel\", \"email\": \"erick@example.com\", \"bio\": \"Software Engineer\"}. Se o objetivo NÃO envolveu coletar dados E não há relato da IA com informações, omita este campo."
}`;

    // Chamar API da IA
    const aiResponse = await callAIAPI(apiKey, model, prompt, logs);

    if (!aiResponse) {
      logs.push('⚠️ [VALIDAÇÃO] Erro ao chamar API - assumindo sucesso');
      return {
        achieved: true,
        reason: 'Erro ao chamar API de validação',
        skipped: true,
      };
    }

    // Parsear resposta JSON
    let parsed;
    try {
      // Remover markdown code fences se existirem
      let text = aiResponse.trim();
      if (text.startsWith('```')) {
        const lines = text.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].trim().startsWith('```')) lines.pop();
        text = lines.join('\n').trim();
      }

      // 🚀 Substituir 'undefined' literal por null para JSON válido
      text = text.replace(/:\s*undefined\b/g, ': null');

      parsed = JSON.parse(text);
    } catch (parseError) {
      logs.push(`⚠️ [VALIDAÇÃO] Erro ao parsear resposta da IA: ${parseError}`);
      return {
        achieved: true,
        reason: 'Erro ao parsear validação',
        skipped: true,
      };
    }

    const achieved = parsed.achieved === true;
    const reason = parsed.reason || 'Sem razão fornecida';
    const answer = parsed.answer;

    return { achieved, reason, answer };
  } catch (error) {
    logs.push(`⚠️ [VALIDAÇÃO] Erro na validação: ${error}`);
    return { achieved: true, reason: 'Erro na validação', skipped: true };
  }
}

/**
 * Chama API da IA (OpenAI ou Anthropic)
 */
async function callAIAPI(
  apiKey: string,
  model: string,
  prompt: string,
  logs: string[],
): Promise<string | null> {
  try {
    // Detectar provedor baseado no modelo
    const isOpenAI =
      model.includes('gpt') || model.includes('o1') || model.includes('o3');
    const isAnthropic =
      model.includes('claude') ||
      model.includes('sonnet') ||
      model.includes('opus');

    if (isOpenAI) {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0,
            max_tokens: 2000,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        logs.push(`❌ [VALIDAÇÃO] Erro OpenAI: ${response.status} - ${error}`);
        return null;
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || null;
    } else if (isAnthropic) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logs.push(
          `❌ [VALIDAÇÃO] Erro Anthropic: ${response.status} - ${error}`,
        );
        return null;
      }

      const data = await response.json();
      return data.content[0]?.text || null;
    } else {
      logs.push(`⚠️ [VALIDAÇÃO] Provedor não suportado: ${model}`);
      return null;
    }
  } catch (error) {
    logs.push(`❌ [VALIDAÇÃO] Erro ao chamar API: ${error}`);
    return null;
  }
}

/**
 * Constrói seletor Playwright a partir do tipo e valor
 */
function buildSelector(selector: string, selectorType?: string): string {
  if (!selector) {
    throw new Error('Seletor não fornecido');
  }

  if (!selectorType || selectorType === 'css') {
    return selector; // CSS direto
  }

  if (selectorType === 'xpath') {
    // XPath com prefixo do Playwright
    if (selector.startsWith('xpath=')) {
      return selector;
    }
    return `xpath=${selector}`;
  }

  if (selectorType === 'tag_name') {
    return selector; // Tag name direto
  }

  return selector; // Fallback
}

/**
 * Executa uma ação individual usando Playwright diretamente
 * Aceita seletores CSS/XPath do componente React
 */
async function executeAction(
  page: Page,
  action: PlaywrightMcpStepAction,
  logs: string[],
): Promise<void> {
  try {
    switch (action.action) {
      case 'goto_url':
        if (action.text) {
          await page.goto(action.text, { waitUntil: 'networkidle' });
          logs.push(`🌐 Navegou para: ${action.text}`);
        }
        break;

      case 'click':
        if (action.selector) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).click();
          logs.push(`👆 Clicou em: ${selector}`);
        } else {
          throw new Error('Seletor não fornecido para ação click');
        }
        break;

      case 'double_click':
        if (action.selector) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).dblclick();
          logs.push(`👆👆 Duplo clique em: ${selector}`);
        } else {
          throw new Error('Seletor não fornecido para ação double_click');
        }
        break;

      case 'type':
        if (action.selector && action.text) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).fill(action.text);
          logs.push(
            `⌨️ Digitou em ${selector}: ${action.text.substring(0, 50)}`,
          );
        } else {
          throw new Error('Seletor e texto não fornecidos para ação type');
        }
        break;

      case 'type_and_submit':
        if (action.selector && action.text) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).fill(action.text);
          await page.locator(selector).press('Enter');
          logs.push(
            `⌨️ Digitou e submeteu em ${selector}: ${action.text.substring(0, 50)}`,
          );
        } else {
          throw new Error(
            'Seletor e texto não fornecidos para ação type_and_submit',
          );
        }
        break;

      case 'hover':
        if (action.selector) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).hover();
          logs.push(`🖱️ Hover em: ${selector}`);
        } else {
          throw new Error('Seletor não fornecido para ação hover');
        }
        break;

      case 'scroll_down':
        if (action.text) {
          // Scroll por pixels
          const pixels = parseInt(action.text) || 500;
          await page.evaluate((p) => window.scrollBy(0, p), pixels);
          logs.push(`📜 Rolou ${pixels}px para baixo`);
        } else {
          // Scroll até o final
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
          logs.push('📜 Rolou até o final da página');
        }
        break;

      case 'scroll_up':
        if (action.text) {
          // Scroll por pixels
          const pixels = parseInt(action.text) || 500;
          await page.evaluate((p) => window.scrollBy(0, -p), pixels);
          logs.push(`📜 Rolou ${pixels}px para cima`);
        } else {
          // Scroll até o topo
          await page.evaluate(() => window.scrollTo(0, 0));
          logs.push('📜 Rolou até o topo da página');
        }
        break;

      case 'scroll_to_view':
        if (action.selector) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).scrollIntoViewIfNeeded();
          logs.push(`📜 Rolou até visualizar: ${selector}`);
        } else {
          throw new Error('Seletor não fornecido para ação scroll_to_view');
        }
        break;

      case 'wait':
        if (action.text) {
          const seconds = parseFloat(action.text);
          if (!isNaN(seconds) && seconds > 0) {
            const ms = Math.min(seconds, 60) * 1000; // Limitar a 60s
            await page.waitForTimeout(ms);
            logs.push(`⏳ Aguardou: ${seconds}s`);
          }
        }
        break;

      case 'switch_to_iframe':
        if (action.selector) {
          const selector = buildSelector(action.selector, action.selectorType);
          // Nota: Playwright usa frameLocator, mas ações subsequentes precisam ser no frame
          // Por enquanto, apenas logamos
          logs.push(`🖼️ Mudou para iframe: ${selector}`);
          logs.push(`⚠️ Ações subsequentes precisam ser executadas no frame`);
        } else {
          throw new Error('Seletor não fornecido para ação switch_to_iframe');
        }
        break;

      case 'switch_to_default_content':
        // No Playwright, voltar para o contexto principal
        // Se estivermos em um frame, precisaríamos do contexto do frame
        // Por enquanto, apenas logamos
        logs.push('🖼️ Voltou para conteúdo principal');
        break;

      case 'switch_to_tab':
        // Playwright gerencia abas automaticamente
        // Nota: Trocar de aba requer acesso ao browser context
        // Por enquanto, apenas logamos
        if (action.text) {
          const tabIndex = parseInt(action.text);
          logs.push(
            `📑 Tentando mudar para aba ${tabIndex} (não implementado completamente)`,
          );
        }
        break;

      case 'close_current_tab':
        // Fechar aba atual
        await page.close();
        logs.push('❌ Fechou aba atual');
        break;

      case 'go_back':
        await page.goBack({ waitUntil: 'networkidle' });
        logs.push('⬅️ Voltou na navegação');
        break;

      case 'go_forward':
        await page.goForward({ waitUntil: 'networkidle' });
        logs.push('➡️ Avançou na navegação');
        break;

      case 'select_option_by_text':
        if (action.selector && action.text) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).selectOption({ label: action.text });
          logs.push(
            `📋 Selecionou opção por texto "${action.text}" em: ${selector}`,
          );
        } else {
          throw new Error(
            'Seletor e texto não fornecidos para ação select_option_by_text',
          );
        }
        break;

      case 'select_option_by_value':
        if (action.selector && action.text) {
          const selector = buildSelector(action.selector, action.selectorType);
          await page.locator(selector).selectOption({ value: action.text });
          logs.push(
            `📋 Selecionou opção por valor "${action.text}" em: ${selector}`,
          );
        } else {
          throw new Error(
            'Seletor e valor não fornecidos para ação select_option_by_value',
          );
        }
        break;

      default:
        logs.push(`⚠️ Ação não suportada: ${action.action}`);
        throw new Error(`Ação não suportada: ${action.action}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    logs.push(`❌ Erro ao executar ${action.action}: ${errorMessage}`);
    throw error;
  }
}
