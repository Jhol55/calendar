import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tableName, rowId, column, value } = body;

    if (!userId || !tableName || !rowId || !column) {
      return NextResponse.json(
        { error: 'userId, tableName, rowId, and column are required' },
        { status: 400 },
      );
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    // Encontrar a partição que contém o registro
    for (const record of dataRecords) {
      const data = Array.isArray(record.data)
        ? (record.data as Record<string, unknown>[])
        : [];
      const rowIndex = data.findIndex((row) => {
        const rowObj = row as Record<string, unknown>;
        return rowObj._id === rowId;
      });

      if (rowIndex !== -1) {
        // Atualizar o registro
        const rowObj = data[rowIndex] as Record<string, unknown>;
        rowObj[column] = value;
        rowObj._updatedAt = new Date().toISOString();

        // Salvar de volta no banco
        await prisma.dataTable.update({
          where: { id: record.id },
          data: {
            data: data,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update cell';
    console.error('Error updating cell:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
