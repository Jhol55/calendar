import { prisma } from '@/services/prisma';
import { getStorageUsage } from '@/services/subscription/subscription.service';

/**
 * Job de recálculo periódico de armazenamento
 * Valida e corrige discrepâncias no cache
 *
 * Roda diariamente para garantir precisão dos cálculos
 */
export async function recalculateAllStorageUsage(): Promise<{
  processed: number;
  errors: number;
  details: Array<{ userId: number; success: boolean; error?: string }>;
}> {
  console.log('🔄 [Job] Iniciando recálculo periódico de armazenamento...');

  const details: Array<{ userId: number; success: boolean; error?: string }> =
    [];
  let processed = 0;
  let errors = 0;

  try {
    // Buscar todos os usuários com subscription ativa
    const users = await prisma.user.findMany({
      where: {
        subscription: {
          isNot: null,
        },
      },
      select: {
        id: true,
      },
      // Limitar para não sobrecarregar (processar em lotes)
      take: 1000,
    });

    console.log(`📊 [Job] Processando ${users.length} usuários...`);

    // Processar em lotes de 10 para não sobrecarregar o banco
    const BATCH_SIZE = 10;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Recalcular storage usage
            await getStorageUsage(user.id);
            processed++;
            details.push({ userId: user.id, success: true });
          } catch (error: unknown) {
            errors++;
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            details.push({
              userId: user.id,
              success: false,
              error: errorMessage,
            });
            console.error(
              `❌ [Job] Erro ao recalcular storage do usuário ${user.id}:`,
              errorMessage,
            );
          }
        }),
      );

      // Pequena pausa entre lotes para não sobrecarregar
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `✅ [Job] Recálculo concluído: ${processed} processados, ${errors} erros`,
    );
  } catch (error: unknown) {
    console.error(
      '❌ [Job] Erro crítico no recálculo de armazenamento:',
      error,
    );
    throw error;
  }

  return { processed, errors, details };
}

/**
 * Recalcular storage de um usuário específico
 */
export async function recalculateUserStorage(userId: number): Promise<boolean> {
  try {
    await getStorageUsage(userId);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Erro ao recalcular storage do usuário ${userId}:`,
      errorMessage,
    );
    return false;
  }
}
