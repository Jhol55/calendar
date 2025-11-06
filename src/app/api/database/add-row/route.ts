import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { DATABASE_CONFIG } from '@/config/database.config';
import { canUseStorage } from '@/services/subscription/subscription.service';

// Type helper para Prisma JSON fields - necessário usar any devido à tipagem do Prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaJsonValue = any;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tableName, data } = body;

    if (!userId || !tableName || !data) {
      return NextResponse.json(
        { error: 'userId, tableName, and data are required' },
        { status: 400 },
      );
    }

    // Verificar limite de armazenamento antes de inserir
    try {
      const user = await prisma.user.findUnique({
        where: { email: userId },
        select: { id: true },
      });

      if (user) {
        // Estimar tamanho do registro em MB (JSON stringified)
        const recordSizeBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
        const recordSizeMB = recordSizeBytes / (1024 * 1024);
        const check = await canUseStorage(user.id, recordSizeMB);
        if (!check.allowed) {
          return NextResponse.json(
            { error: check.message || 'Limite de armazenamento atingido' },
            { status: 403 },
          );
        }
      }
    } catch (error) {
      // Ignorar erros de validação de armazenamento (não bloquear se falhar)
      console.warn('Erro ao validar limite de armazenamento:', error);
    }

    // Buscar a partição ativa (não cheia)
    const activePartition = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
        isFull: false,
      },
      orderBy: {
        partition: 'desc',
      },
    });

    if (!activePartition) {
      return NextResponse.json(
        { error: 'No active partition found. Create a table first.' },
        { status: 404 },
      );
    }

    // Pegar os dados atuais
    const currentData = (
      Array.isArray(activePartition.data) ? activePartition.data : []
    ) as Record<string, unknown>[];

    // Adicionar novo registro
    currentData.push(data as Record<string, unknown>);

    // Verificar se atingiu o limite
    const isFull = currentData.length >= DATABASE_CONFIG.MAX_PARTITION_SIZE;

    // Atualizar a partição
    await prisma.dataTable.update({
      where: { id: activePartition.id },
      data: {
        data: currentData as PrismaJsonValue,
        recordCount: currentData.length,
        isFull,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to add row';
    console.error('Error adding row:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
