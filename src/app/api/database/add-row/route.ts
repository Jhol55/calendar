import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { DATABASE_CONFIG } from '@/config/database.config';

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
    const currentData = (activePartition.data as any[]) || [];

    // Adicionar novo registro
    currentData.push(data);

    // Verificar se atingiu o limite
    const isFull = currentData.length >= DATABASE_CONFIG.MAX_PARTITION_SIZE;

    // Atualizar a partição
    await prisma.dataTable.update({
      where: { id: activePartition.id },
      data: {
        data: currentData as any,
        recordCount: currentData.length,
        isFull,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error adding row:', error);
    return NextResponse.json({ error: 'Failed to add row' }, { status: 500 });
  }
}
