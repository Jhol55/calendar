import { prisma } from '@/services/prisma';
import { replaceVariables } from './variable-replacer';

interface LoopState {
  currentIndex: number;
  items: unknown[];
  accumulatedResults?: unknown[];
  iterationCount: number;
}

interface ProcessLoopNodeParams {
  executionId: string;
  nodeId: string;
  config: {
    inputData: string;
    batchSize: number;
    mode: 'each' | 'batch';
    accumulateResults?: boolean;
    outputVariable?: string;
    maxIterations?: number;
    pauseBetweenIterations?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableContext: any;
}

export async function processLoopNode(params: ProcessLoopNodeParams): Promise<{
  batch: unknown;
  hasMore: boolean;
  selectedHandle: 'loop' | 'done';
  loopVariable: Record<string, unknown>;
  accumulatedResults?: unknown[];
  iterationCount: number;
}> {
  const { executionId, nodeId, config, variableContext } = params;

  console.log(`🔁 Processing Loop Node ${nodeId}`);

  // Recuperar estado do loop da execução
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
    select: { loopStates: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loopStates = (execution?.loopStates as any) || {};
  let loopState: LoopState = loopStates[nodeId];

  // Se não existe estado, é a primeira execução deste loop
  if (!loopState) {
    console.log(`📥 First execution of loop ${nodeId} - initializing state`);
    console.log(`📥 Input data config: ${config.inputData}`);
    console.log(`📥 Variable context keys: ${Object.keys(variableContext)}`);

    // Resolver inputData (pode ser variável ou array literal)
    const resolvedInput = replaceVariables(config.inputData, variableContext);
    console.log(`📥 Resolved input type: ${typeof resolvedInput}`);
    console.log(`📥 Resolved input is array: ${Array.isArray(resolvedInput)}`);

    let items: unknown[];
    if (typeof resolvedInput === 'string') {
      try {
        // Tentar parsear como JSON se for string
        items = JSON.parse(resolvedInput);
        console.log(`📥 Parsed JSON string to array of ${items.length} items`);
      } catch {
        // Se não for JSON, tratar como array de 1 item
        items = [resolvedInput];
        console.log(`📥 Treating string as single item array`);
      }
    } else if (Array.isArray(resolvedInput)) {
      items = resolvedInput;
      console.log(`📥 Input is already an array of ${items.length} items`);
    } else {
      // Se for objeto ou outro tipo, colocar em array
      items = [resolvedInput];
      console.log(`📥 Wrapping ${typeof resolvedInput} in array`);
    }

    if (!Array.isArray(items)) {
      throw new Error(
        'Input data must be an array or resolve to an array. Got: ' +
          typeof items,
      );
    }

    console.log(`📊 Loop initialized with ${items.length} items`);
    console.log(`📊 First item preview:`, items[0]);

    loopState = {
      currentIndex: 0,
      items,
      accumulatedResults: config.accumulateResults ? [] : undefined,
      iterationCount: 0,
    };
  }

  // Verificar limite de iterações
  if (
    config.maxIterations &&
    loopState.iterationCount >= config.maxIterations
  ) {
    console.log(
      `⚠️ Max iterations (${config.maxIterations}) reached. Ending loop.`,
    );

    // Limpar estado do loop
    delete loopStates[nodeId];
    await prisma.flow_executions.update({
      where: { id: executionId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { loopStates: loopStates as any },
    });

    return {
      batch: loopState.accumulatedResults || [],
      hasMore: false,
      selectedHandle: 'done',
      loopVariable: {
        [config.outputVariable || 'loopItem']: null,
        index: loopState.currentIndex,
        total: loopState.items.length,
        isLast: true,
      },
      accumulatedResults: loopState.accumulatedResults,
      iterationCount: loopState.iterationCount,
    };
  }

  // Pegar próximo batch
  const startIndex = loopState.currentIndex;
  const endIndex = startIndex + config.batchSize;
  const batch = loopState.items.slice(startIndex, endIndex);

  console.log(
    `📦 Processing batch: items ${startIndex} to ${endIndex - 1} (${batch.length} items)`,
  );

  // Atualizar índice e contador
  loopState.currentIndex = endIndex;
  loopState.iterationCount += 1;

  // Verificar se ainda há mais itens
  const hasMore = loopState.currentIndex < loopState.items.length;

  console.log(
    `📊 Progress: ${loopState.currentIndex}/${loopState.items.length} items processed`,
  );
  console.log(`🔄 Iteration ${loopState.iterationCount}, Has more: ${hasMore}`);

  if (hasMore) {
    // Salvar estado atualizado para próxima iteração
    loopStates[nodeId] = loopState;
    await prisma.flow_executions.update({
      where: { id: executionId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { loopStates: loopStates as any },
    });

    // Aplicar pausa se configurada
    if (config.pauseBetweenIterations && config.pauseBetweenIterations > 0) {
      console.log(
        `⏸️ Pausing for ${config.pauseBetweenIterations}ms before next iteration`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, config.pauseBetweenIterations),
      );
    }

    return {
      batch: config.mode === 'each' ? batch[0] : batch,
      hasMore: true,
      selectedHandle: 'loop',
      loopVariable: {
        [config.outputVariable || 'loopItem']:
          config.mode === 'each' ? batch[0] : batch,
        index: startIndex,
        total: loopState.items.length,
        isLast: false,
        currentBatch: batch,
      },
      iterationCount: loopState.iterationCount,
    };
  } else {
    console.log(
      `✅ Loop completed! Total iterations: ${loopState.iterationCount}`,
    );

    // Loop concluído - processar último batch e limpar estado
    if (config.accumulateResults && loopState.accumulatedResults) {
      if (config.mode === 'each') {
        loopState.accumulatedResults.push(...batch);
      } else {
        loopState.accumulatedResults.push(batch);
      }
    }

    // Limpar estado do loop
    delete loopStates[nodeId];
    await prisma.flow_executions.update({
      where: { id: executionId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { loopStates: loopStates as any },
    });

    return {
      batch: config.mode === 'each' ? batch[0] : batch,
      hasMore: false,
      selectedHandle: 'done',
      loopVariable: {
        [config.outputVariable || 'loopItem']:
          config.mode === 'each' ? batch[0] : batch,
        index: startIndex,
        total: loopState.items.length,
        isLast: true,
        currentBatch: batch,
      },
      accumulatedResults: loopState.accumulatedResults,
      iterationCount: loopState.iterationCount,
    };
  }
}
