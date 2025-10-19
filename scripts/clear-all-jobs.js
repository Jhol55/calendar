const Queue = require('bull');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function clearAll() {
  console.log('🗑️  Clearing ALL webhook jobs and executions...\n');

  // 1. Limpar fila do Bull
  console.log('📦 Step 1: Clearing Bull queue...');
  const webhookQueue = new Queue('webhook-processing', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  try {
    const waiting = await webhookQueue.clean(0, 'wait');
    console.log(`   ✅ Removed ${waiting.length} waiting jobs`);

    const active = await webhookQueue.clean(0, 'active');
    console.log(`   ✅ Removed ${active.length} active jobs`);

    const delayed = await webhookQueue.clean(0, 'delayed');
    console.log(`   ✅ Removed ${delayed.length} delayed jobs`);

    const completed = await webhookQueue.clean(0, 'completed');
    console.log(`   ✅ Removed ${completed.length} completed jobs`);

    const failed = await webhookQueue.clean(0, 'failed');
    console.log(`   ✅ Removed ${failed.length} failed jobs`);

    // Esvaziar a fila completamente
    await webhookQueue.empty();
    console.log('   🧹 Queue emptied\n');

    await webhookQueue.close();
  } catch (error) {
    console.error('   ❌ Error clearing queue:', error.message);
  }

  // 2. Limpar execuções "running" do banco
  console.log('🗄️  Step 2: Clearing running executions from database...');
  try {
    const runningExecutions = await prisma.flow_executions.findMany({
      where: { status: 'running' },
      select: { id: true, flowId: true, startTime: true },
    });

    console.log(`   📊 Found ${runningExecutions.length} running executions`);

    if (runningExecutions.length > 0) {
      // Atualizar para "stopped" em vez de deletar (manter histórico)
      const updated = await prisma.flow_executions.updateMany({
        where: { status: 'running' },
        data: {
          status: 'stopped',
          endTime: new Date(),
          error: 'Stopped during queue cleanup',
        },
      });

      console.log(`   ✅ Stopped ${updated.count} running executions\n`);
    } else {
      console.log('   ✅ No running executions found\n');
    }
  } catch (error) {
    console.error('   ❌ Error updating database:', error.message);
  }

  // 3. Opcional: Limpar execuções antigas (completed/error/stopped > 24h)
  console.log('🧹 Step 3: Cleaning old executions (optional)...');
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const oldExecutions = await prisma.flow_executions.count({
      where: {
        status: { in: ['success', 'error', 'stopped'] },
        endTime: { lt: oneDayAgo },
      },
    });

    console.log(`   📊 Found ${oldExecutions} old executions (>24h)`);
    console.log('   ℹ️  Keeping them for history (not deleting)\n');
  } catch (error) {
    console.error('   ❌ Error checking old executions:', error.message);
  }

  await prisma.$disconnect();

  console.log('✨ All jobs and executions cleared successfully!');
  console.log('🚀 You can now restart the worker with: npm run worker\n');

  process.exit(0);
}

clearAll().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
