import cron from 'node-cron';
import { limparMemoriasExpiradas } from './node-processors/memory-helper';

/**
 * Job de limpeza automática de memórias expiradas
 * Roda todo dia às 3h da manhã
 */
export function iniciarJobLimpezaMemoria() {
  // Roda todo dia às 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 [Job] Iniciando limpeza de memórias expiradas...');

    try {
      const count = await limparMemoriasExpiradas();

      if (count > 0) {
        console.log(
          `✅ [Job] ${count} memórias expiradas removidas com sucesso`,
        );
      } else {
        console.log('✅ [Job] Nenhuma memória expirada encontrada');
      }
    } catch (error) {
      console.error('❌ [Job] Erro na limpeza de memórias:', error);
    }
  });

  console.log('✅ Job de limpeza de memórias agendado (todo dia às 3:00 AM)');
}
