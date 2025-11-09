/**
 * API endpoint para limpeza de flows temporários
 * GET /api/admin/cleanup-temp-flows
 */

import { NextResponse } from 'next/server';

// Forçar rota dinâmica para evitar problemas durante o build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Importar Prisma apenas em runtime (lazy import)
    const { prisma } = await import('@/services/prisma');

    // TODO: Adicionar autenticação de admin aqui
    // const session = await getSession();
    // if (!session || !session.user?.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('🧹 Iniciando limpeza de flows temporários via API...');

    // Deletar flows temporários com mais de 24 horas
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // ✅ Buscar apenas flows marcados explicitamente como temporários
    const oldTempFlows = await prisma.chatbot_flows.findMany({
      where: {
        isTemporary: true, // ✅ Flag segura - apenas flows marcados explicitamente
        updatedAt: {
          lt: oneDayAgo,
        },
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        userId: true,
      },
    });

    console.log(
      `📊 Encontrados ${oldTempFlows.length} flows temporários antigos`,
    );

    if (oldTempFlows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum flow temporário antigo encontrado',
        deleted: {
          flows: 0,
          executions: 0,
        },
      });
    }

    // Deletar execuções relacionadas primeiro
    const flowIds = oldTempFlows.map((f) => f.id);

    const deletedExecutions = await prisma.flow_executions.deleteMany({
      where: {
        flowId: {
          in: flowIds,
        },
      },
    });

    // Deletar flows temporários
    const deletedFlows = await prisma.chatbot_flows.deleteMany({
      where: {
        id: {
          in: flowIds,
        },
      },
    });

    console.log(
      `✅ Deletados ${deletedFlows.count} flows e ${deletedExecutions.count} execuções`,
    );

    return NextResponse.json({
      success: true,
      message: 'Limpeza concluída com sucesso',
      deleted: {
        flows: deletedFlows.count,
        executions: deletedExecutions.count,
      },
      details: oldTempFlows.map((f) => ({
        id: f.id,
        name: f.name,
        userId: f.userId,
        updatedAt: f.updatedAt,
      })),
    });
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 },
    );
  }
}
