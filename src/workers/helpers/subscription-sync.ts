import cron from 'node-cron';
import {
  checkSyncStatus,
  syncAllSubscriptions,
} from '@/services/stripe/sync.service';

/**
 * Job de sincronização automática de assinaturas Stripe
 * Roda diariamente às 2:00 AM para garantir sincronização
 */
export function iniciarJobSincronizacaoAssinaturas() {
  // Roda todo dia às 2:00 AM (antes da limpeza de memórias)
  cron.schedule('0 2 * * *', async () => {
    console.log(
      '🔄 [Job] Iniciando sincronização automática de assinaturas...',
    );

    try {
      // Primeiro, verificar status
      const status = await checkSyncStatus();

      if (status.outOfSync > 0 || status.missing > 0) {
        console.log(
          `⚠️ [Job] Encontradas ${status.outOfSync} assinaturas dessincronizadas e ${status.missing} faltando`,
        );

        // Executar sincronização completa
        const result = await syncAllSubscriptions();

        if (result.success) {
          console.log(
            `✅ [Job] Sincronização concluída: ${result.processed} processadas, ${result.errors} erros`,
          );

          if (result.errors > 0) {
            console.warn(
              `⚠️ [Job] Detalhes dos erros:`,
              result.details.filter((d) => d.error),
            );
          }
        } else {
          console.error(
            `❌ [Job] Sincronização falhou: ${result.errors} erros`,
          );
        }
      } else {
        console.log('✅ [Job] Todas as assinaturas estão sincronizadas');
      }
    } catch (error: any) {
      console.error(
        '❌ [Job] Erro na sincronização de assinaturas:',
        error.message,
      );
    }
  });

  console.log(
    '✅ Job de sincronização de assinaturas agendado (todo dia às 2:00 AM)',
  );
}
