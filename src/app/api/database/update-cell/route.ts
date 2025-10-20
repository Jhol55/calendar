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
      const data = record.data as any[];
      const rowIndex = data.findIndex((row: any) => row._id === rowId);

      if (rowIndex !== -1) {
        // Atualizar o registro
        data[rowIndex][column] = value;
        data[rowIndex]._updatedAt = new Date().toISOString();

        // Salvar de volta no banco
        await prisma.dataTable.update({
          where: { id: record.id },
          data: {
            data: data as any,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  } catch (error) {
    console.error('Error updating cell:', error);
    return NextResponse.json(
      { error: 'Failed to update cell' },
      { status: 500 },
    );
  }
}
