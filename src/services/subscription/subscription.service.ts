import { prisma } from '@/services/prisma';
import { SubscriptionStatus } from '@/types/subscription';
import { redis } from '@/services/queue';

/**
 * Buscar plano atual do usuário (incluindo trial)
 */
export async function getUserPlan(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: { plan: true },
      },
      plan: true,
    },
  });

  if (!user) {
    return null;
  }

  // Se tem subscription ativa, usar ela
  if (user.subscription) {
    const sub = user.subscription;
    const now = new Date();

    // Verificar se está em trial
    const isTrialing =
      sub.status === 'trialing' || (sub.trialEndsAt && sub.trialEndsAt > now);

    // Verificar se está ativa (incluindo trial)
    const isActive =
      sub.status === 'active' ||
      sub.status === 'trialing' ||
      (sub.status === 'past_due' && sub.cancelAtPeriodEnd === false);

    if (isActive && sub.plan) {
      return {
        plan: sub.plan,
        subscription: sub,
        isTrialing,
        isActive: true,
      };
    }
  }

  // Se não tem subscription, verificar se tem plano direto (free tier ou default)
  if (user.plan) {
    return {
      plan: user.plan,
      subscription: null,
      isTrialing: false,
      isActive: true,
    };
  }

  return null;
}

/**
 * Verificar se usuário pode criar recurso baseado no limite
 */
export async function checkPlanLimit(
  userId: number,
  limitType: 'storage' | 'instances',
): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  message?: string;
}> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      message: 'Você precisa ter um plano ativo para usar este recurso',
    };
  }

  const { plan } = userPlan;

  // Buscar limites atuais do usuário
  const limits = await prisma.user_plan_limits.findUnique({
    where: { userId },
  });

  // Converter de centésimos para MB
  // Valores < 10 são MB diretos antigos (1, 2, 3...)
  // Valores >= 10 são centésimos novos (76 = 0.76MB, 150 = 1.50MB)
  // Exception: se dividir por 100 e der > 100GB, então era MB direto
  const currentStorageMB = limits?.currentStorageMB
    ? (() => {
        if (limits.currentStorageMB < 10) {
          return limits.currentStorageMB; // Valores antigos em MB direto
        }
        const asMB = limits.currentStorageMB / 100;
        return asMB > 100000 ? limits.currentStorageMB : asMB;
      })()
    : 0;
  const currentInstances = limits?.currentInstances || 0;

  if (limitType === 'storage') {
    const allowed = currentStorageMB < plan.maxStorageMB;
    return {
      allowed,
      current: currentStorageMB,
      max: plan.maxStorageMB,
      message: allowed
        ? undefined
        : `Limite de armazenamento atingido (${plan.maxStorageMB}MB). Faça upgrade do seu plano.`,
    };
  } else {
    // instances
    if (plan.maxInstances === -1) {
      return {
        allowed: true,
        current: currentInstances,
        max: -1,
      };
    }

    const allowed = currentInstances < plan.maxInstances;
    return {
      allowed,
      current: currentInstances,
      max: plan.maxInstances,
      message: allowed
        ? undefined
        : `Limite de instâncias atingido (${plan.maxInstances}). Faça upgrade do seu plano.`,
    };
  }
}

/**
 * Calcular armazenamento usado pelo usuário
 *
 * IMPORTANTE: Função crítica para limites de plano
 * - SEMPRE calcula valor real do banco (sem cache)
 * - Usa pg_column_size() para precisão máxima
 * - Atualiza cache após cálculo para UI
 *
 * @param userId ID do usuário
 * @param _forceRecalc Deprecated - mantido para compatibilidade com testes (ignorado)
 * @returns Armazenamento usado em MB (com 2 casas decimais)
 */
export async function getStorageUsage(
  userId: number,
  _forceRecalc?: boolean,
): Promise<number> {
  try {
    const userIdStr = String(userId); // userId na tabela é o ID numérico como string

    // SEMPRE calcular valor real (sem cache)
    // pg_column_size() retorna o tamanho REAL em bytes do valor armazenado
    const result = await prisma.$queryRaw<Array<{ total_bytes: bigint }>>`
      SELECT 
        COALESCE(SUM(
          pg_column_size("data") + 
          pg_column_size("schema")
        ), 0) as total_bytes
      FROM "DataTable"
      WHERE "userId" = ${userIdStr}
    `;

    const dataTableBytes = Number(result[0]?.total_bytes || 0);

    // Calcular tamanho das memórias do chatbot
    const memoriesResult = await prisma.$queryRaw<
      Array<{ total_bytes: bigint }>
    >`
      SELECT 
        COALESCE(SUM(pg_column_size("valor")), 0) as total_bytes
      FROM "chatbot_memories"
      WHERE "userId" = ${userIdStr}
    `;

    const memoriesBytes = Number(memoriesResult[0]?.total_bytes || 0);

    // Total em bytes
    const totalSizeBytes = dataTableBytes + memoriesBytes;

    // Converter para MB com precisão de 2 casas decimais
    const totalSizeMB = totalSizeBytes / (1024 * 1024);

    // Arredondar para 2 casas decimais (evitar usar Math.round antes de dividir)
    const totalSizeMBRounded = Math.floor(totalSizeMB * 100) / 100;

    // Salvar como centésimos de MB (0.57MB = 57) para manter precisão em campo Int
    const storageMBAsCents = Math.round(totalSizeMBRounded * 100);

    // Atualizar cache PostgreSQL (para UI/billing)
    // Redis removido - não cachear funções críticas
    await prisma.user_plan_limits.upsert({
      where: { userId },
      create: {
        userId,
        currentStorageMB: storageMBAsCents,
        currentInstances: 0,
      },
      update: {
        currentStorageMB: storageMBAsCents,
      },
    });

    return totalSizeMBRounded;
  } catch (error: unknown) {
    // Fallback para método antigo se houver erro (ex: banco antigo sem pg_column_size)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      '⚠️ Erro ao calcular storage com SQL otimizado, usando fallback:',
      errorMessage,
    );

    return getStorageUsageFallback(userId);
  }
}

/**
 * Método fallback (versão antiga) caso o SQL otimizado falhe
 * Usado apenas como backup se houver problemas com pg_column_size
 */
async function getStorageUsageFallback(userId: number): Promise<number> {
  const userIdStr = String(userId); // userId na tabela é o ID numérico como string

  // Buscar todas as tabelas do usuário
  const tables = await prisma.dataTable.findMany({
    where: {
      userId: userIdStr,
    },
    select: {
      data: true,
      schema: true,
    },
    // Limitar a 100 registros para evitar timeout
    take: 100,
  });

  // Calcular tamanho aproximado dos dados JSON
  let totalSizeBytes = 0;

  for (const table of tables) {
    if (table.data) {
      const jsonString = JSON.stringify(table.data);
      totalSizeBytes += Buffer.byteLength(jsonString, 'utf8');
    }
    if (table.schema) {
      const schemaString = JSON.stringify(table.schema);
      totalSizeBytes += Buffer.byteLength(schemaString, 'utf8');
    }
  }

  // Buscar memórias (limitado também)
  const memories = await prisma.chatbot_memories.findMany({
    where: {
      userId: userIdStr,
    },
    select: {
      valor: true,
    },
    take: 1000,
  });

  for (const memory of memories) {
    if (memory.valor) {
      const jsonString = JSON.stringify(memory.valor);
      totalSizeBytes += Buffer.byteLength(jsonString, 'utf8');
    }
  }

  // Converter para MB com precisão de 2 casas decimais
  const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;

  // Salvar como centésimos de MB (0.57MB = 57) para manter precisão em campo Int
  const storageMBAsCents = Math.round(totalSizeMB * 100);

  // Atualizar cache
  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB: storageMBAsCents,
      currentInstances: 0,
    },
    update: {
      currentStorageMB: storageMBAsCents,
    },
  });

  return totalSizeMB;
}

/**
 * Contar instâncias do usuário
 */
export async function getInstanceCount(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return 0;
  }

  const count = await prisma.instances.count({
    where: {
      adminField01: user.email,
    },
  });

  // Atualizar cache
  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB: 0,
      currentInstances: count,
    },
    update: {
      currentInstances: count,
    },
  });

  return count;
}

/**
 * Verificar se pode criar instância
 */
export async function canCreateInstance(
  userId: number,
): Promise<{ allowed: boolean; message?: string }> {
  const limitCheck = await checkPlanLimit(userId, 'instances');

  if (!limitCheck.allowed) {
    return {
      allowed: false,
      message: limitCheck.message,
    };
  }

  return { allowed: true };
}

/**
 * Validar se downgrade de plano é permitido baseado no uso atual
 * Bloqueia downgrade se:
 * - Uso de armazenamento atual > limite do novo plano
 * - Número de instâncias atual > limite do novo plano
 *
 * @param userId ID do usuário
 * @param newPlan Novo plano para o qual está tentando fazer downgrade
 * @returns Resultado da validação com mensagens de erro específicas
 */
export async function validatePlanDowngrade(
  userId: number,
  newPlan: { maxStorageMB: number; maxInstances: number; name: string },
): Promise<{
  allowed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // SEMPRE calcular armazenamento real (dados podem ser inseridos fora do sistema)
  const actualStorageMB = await getStorageUsage(userId);

  // Para instâncias, usar cache se disponível (valor controlado pelo sistema)
  // Se não houver cache, calcular
  const limits = await prisma.user_plan_limits.findUnique({
    where: { userId },
    select: { currentInstances: true },
  });

  const actualInstances =
    limits?.currentInstances ?? (await getInstanceCount(userId));

  // Verificar armazenamento
  if (newPlan.maxStorageMB !== -1 && actualStorageMB > newPlan.maxStorageMB) {
    errors.push(
      `Você está usando ${actualStorageMB}MB de armazenamento, mas o plano ${newPlan.name} permite apenas ${newPlan.maxStorageMB}MB. Para fazer downgrade, você precisa liberar espaço primeiro.`,
    );
  }

  // Verificar instâncias
  if (newPlan.maxInstances !== -1 && actualInstances > newPlan.maxInstances) {
    const excessInstances = actualInstances - newPlan.maxInstances;
    errors.push(
      `Você tem ${actualInstances} instância${actualInstances > 1 ? 's' : ''} criada${actualInstances > 1 ? 's' : ''}, mas o plano ${newPlan.name} permite apenas ${newPlan.maxInstances}. Para fazer downgrade, você precisa excluir ${excessInstances} instância${excessInstances > 1 ? 's' : ''} antes.`,
    );
  }

  return {
    allowed: errors.length === 0,
    errors,
  };
}

/**
 * Atualizar armazenamento incrementalmente (muito mais rápido)
 * Use quando souber exatamente quanto foi adicionado/removido
 *
 * @param userId ID do usuário
 * @param deltaMB Diferença em MB (positivo = adicionou, negativo = removeu)
 */
/**
 * Atualizar armazenamento incrementalmente
 *
 * NOTA: Esta função usa estimativas baseadas em Buffer.byteLength(),
 * que podem ser menores que o tamanho real no PostgreSQL (pg_column_size).
 * O PostgreSQL adiciona overhead de metadados, TOAST, compressão, etc.
 *
 * Para valores precisos, use getStorageUsage(forceRecalc: true) periodicamente.
 */
export async function updateStorageUsageIncremental(
  userId: number,
  deltaMB: number,
): Promise<number> {
  const limits = await prisma.user_plan_limits.findUnique({
    where: { userId },
  });

  const currentStorageMB = limits?.currentStorageMB || 0;

  // Adicionar fator de overhead do PostgreSQL (~1.3x para JSONB com compressão e metadados)
  // Isso aproxima o valor de pg_column_size() que é usado no cálculo real
  const OVERHEAD_FACTOR = 1.3;
  const adjustedDeltaMB = deltaMB * OVERHEAD_FACTOR;

  // Converter valor atual de centésimos para MB
  // Valores < 10 são MB diretos antigos, valores >= 10 são centésimos
  const currentMB =
    currentStorageMB < 10
      ? currentStorageMB
      : (() => {
          const asMB = currentStorageMB / 100;
          return asMB > 100000 ? currentStorageMB : asMB;
        })();

  // Calcular novo valor com precisão de 2 casas decimais
  const newStorageMB = Math.max(
    0,
    Math.round((currentMB + adjustedDeltaMB) * 100) / 100,
  );

  // Salvar como centésimos de MB (0.57MB = 57) para manter precisão em campo Int
  const storageMBAsCents = Math.round(newStorageMB * 100);

  // Atualizar estimativa no banco (para UI/billing)
  // IMPORTANTE: Isso é apenas uma estimativa.
  // Verificações de limite usam getStorageUsage() que calcula o valor real.
  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB: storageMBAsCents,
      currentInstances: 0,
    },
    update: {
      currentStorageMB: storageMBAsCents,
    },
  });

  return newStorageMB;
}

/**
 * Invalidar cache de armazenamento (não necessário mais)
 * @deprecated Mantido para compatibilidade, mas não faz nada
 */
export async function invalidateStorageCache(userId: number): Promise<void> {
  // Não necessário - getStorageUsage sempre calcula valor real
  return;
}

/**
 * Verificar se pode usar armazenamento
 */
export async function canUseStorage(
  userId: number,
  sizeMB: number,
): Promise<{ allowed: boolean; message?: string }> {
  // Buscar plano do usuário
  const userPlan = await getUserPlan(userId);

  if (!userPlan) {
    return {
      allowed: false,
      message: 'Você precisa ter um plano ativo para usar este recurso',
    };
  }

  const { plan } = userPlan;

  // Se o limite é -1 (ilimitado), sempre permitir
  if (plan.maxStorageMB === -1) {
    return { allowed: true };
  }

  // SEMPRE calcular uso real (sem cache) - FUNÇÃO CRÍTICA
  const currentUsage = await getStorageUsage(userId);

  if (currentUsage + sizeMB > plan.maxStorageMB) {
    return {
      allowed: false,
      message: `Armazenamento insuficiente. Disponível: ${(plan.maxStorageMB - currentUsage).toFixed(2)}MB, Necessário: ${sizeMB.toFixed(2)}MB`,
    };
  }

  return { allowed: true };
}
