const Queue = require('bull');

async function clearQueue() {
  console.log('🗑️  Clearing webhook queue...');

  const webhookQueue = new Queue('webhook-processing', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  try {
    // Limpar jobs em diferentes estados
    const waiting = await webhookQueue.clean(0, 'wait');
    console.log(`✅ Removed ${waiting.length} waiting jobs`);

    const active = await webhookQueue.clean(0, 'active');
    console.log(`✅ Removed ${active.length} active jobs`);

    const delayed = await webhookQueue.clean(0, 'delayed');
    console.log(`✅ Removed ${delayed.length} delayed jobs`);

    const completed = await webhookQueue.clean(0, 'completed');
    console.log(`✅ Removed ${completed.length} completed jobs`);

    const failed = await webhookQueue.clean(0, 'failed');
    console.log(`✅ Removed ${failed.length} failed jobs`);

    // Limpar keys antigas
    await webhookQueue.empty();
    console.log('🧹 Queue emptied');

    // Fechar conexão
    await webhookQueue.close();

    console.log('✨ Webhook queue cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing queue:', error);
    process.exit(1);
  }
}

clearQueue();
