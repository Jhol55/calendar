#!/usr/bin/env node

/**
 * Script para iniciar o worker de processamento de filas
 *
 * Uso:
 *   node scripts/start-worker.js
 *   npm run worker
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar variáveis de ambiente
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Função principal assíncrona
async function startWorker() {
  try {
    // Obter caminho do arquivo atual
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Importar o worker
    const workerPath = join(__dirname, '../src/workers/webhook-worker.ts');
    await import(`file://${workerPath.replace(/\\/g, '/')}`);

    console.log('🚀 Queue worker started');
    console.log('📊 Monitoring queues: webhook, flow, notification');
    console.log('⏹️  Press Ctrl+C to stop');
  } catch (error) {
    console.error('❌ Error starting worker:', error);
    process.exit(1);
  }
}

// Manter o processo vivo
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping worker...');
  process.exit(0);
});

// Iniciar o worker
startWorker();
