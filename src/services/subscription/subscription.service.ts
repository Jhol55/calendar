import { prisma } from '@/services/prisma';
import { SubscriptionStatus } from '@/types/subscription';

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

  const currentStorageMB = limits?.currentStorageMB || 0;
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
 */
export async function getStorageUsage(userId: number): Promise<number> {
  // Buscar todas as tabelas do usuário
  const tables = await prisma.dataTable.findMany({
    where: {
      userId: userId.toString(),
    },
    select: {
      data: true,
    },
  });

  // Calcular tamanho aproximado dos dados JSON
  let totalSizeBytes = 0;

  for (const table of tables) {
    const jsonString = JSON.stringify(table.data);
    totalSizeBytes += Buffer.byteLength(jsonString, 'utf8');
  }

  // Buscar memórias
  const memories = await prisma.chatbot_memories.findMany({
    where: {
      userId: userId.toString(),
    },
    select: {
      valor: true,
    },
  });

  for (const memory of memories) {
    const jsonString = JSON.stringify(memory.valor);
    totalSizeBytes += Buffer.byteLength(jsonString, 'utf8');
  }

  // Converter para MB (arredondar para cima)
  const totalSizeMB = Math.ceil(totalSizeBytes / (1024 * 1024));

  // Atualizar cache
  await prisma.user_plan_limits.upsert({
    where: { userId },
    create: {
      userId,
      currentStorageMB: totalSizeMB,
      currentInstances: 0, // Será atualizado separadamente
    },
    update: {
      currentStorageMB: totalSizeMB,
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
 * Verificar se pode usar armazenamento
 */
export async function canUseStorage(
  userId: number,
  sizeMB: number,
): Promise<{ allowed: boolean; message?: string }> {
  const currentUsage = await getStorageUsage(userId);
  const limitCheck = await checkPlanLimit(userId, 'storage');

  if (currentUsage + sizeMB > limitCheck.max) {
    return {
      allowed: false,
      message: `Armazenamento insuficiente. Disponível: ${limitCheck.max - currentUsage}MB, Necessário: ${sizeMB}MB`,
    };
  }

  return { allowed: true };
}
