/**
 * Script para migrar webhooks com URL completa para apenas path
 *
 * Transforma:
 * - DE: https://domain.com/api/webhooks/userId/path
 * - PARA: path
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateWebhookUrls() {
  console.log('🔄 Iniciando migração de webhook URLs...\n');

  try {
    // Buscar todos os flows
    const flows = await prisma.chatbot_flows.findMany();
    console.log(`📊 Encontrados ${flows.length} flows no banco\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const flow of flows) {
      let needsUpdate = false;
      const nodes = flow.nodes;

      if (!Array.isArray(nodes)) {
        console.log(
          `⚠️  Flow "${flow.name}" não tem nodes válidos, pulando...`,
        );
        skippedCount++;
        continue;
      }

      // Processar cada node
      const updatedNodes = nodes.map((node) => {
        if (node.type === 'webhook' && node.data?.webhookConfig?.webhookId) {
          const oldWebhookId = node.data.webhookConfig.webhookId;

          // Verificar se é uma URL completa
          if (
            oldWebhookId.includes('://') ||
            oldWebhookId.includes('/api/webhooks/')
          ) {
            console.log(`\n🔧 Flow: "${flow.name}"`);
            console.log(`   Antes: ${oldWebhookId}`);

            // Extrair apenas o path
            let cleanPath = oldWebhookId;

            // Remover protocolo e domínio
            if (cleanPath.includes('://')) {
              const urlParts = cleanPath.split('://')[1].split('/');
              // Pegar tudo depois do domínio
              cleanPath = urlParts.slice(1).join('/');
            }

            // Remover /api/webhooks/
            if (cleanPath.includes('/api/webhooks/')) {
              const parts = cleanPath.split('/api/webhooks/');
              if (parts[1]) {
                // Pode ter userId: userId/path
                const pathParts = parts[1].split('/');
                cleanPath = pathParts[pathParts.length - 1]; // Última parte
              }
            }

            console.log(`   Depois: ${cleanPath}`);

            needsUpdate = true;

            return {
              ...node,
              data: {
                ...node.data,
                webhookConfig: {
                  ...node.data.webhookConfig,
                  webhookId: cleanPath,
                },
              },
            };
          }
        }
        return node;
      });

      // Atualizar flow se necessário
      if (needsUpdate) {
        await prisma.chatbot_flows.update({
          where: { id: flow.id },
          data: { nodes: updatedNodes },
        });
        updatedCount++;
        console.log(`   ✅ Flow atualizado!`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n\n📊 Resumo da Migração:`);
    console.log(`   ✅ Flows atualizados: ${updatedCount}`);
    console.log(`   ⏭️  Flows pulados: ${skippedCount}`);
    console.log(`   📝 Total: ${flows.length}`);
    console.log(`\n✅ Migração concluída com sucesso!`);
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
migrateWebhookUrls();
