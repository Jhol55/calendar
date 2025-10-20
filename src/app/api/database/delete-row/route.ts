import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tableName, rowId } = body;

    if (!userId || !tableName || !rowId) {
      return NextResponse.json(
        { error: 'userId, tableName, and rowId are required' },
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
        // Remover o registro
        data.splice(rowIndex, 1);

        // Salvar de volta no banco
        await prisma.dataTable.update({
          where: { id: record.id },
          data: {
            data: data as any,
            recordCount: data.length,
            isFull: false, // Ao deletar, a partição não está mais cheia
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  } catch (error) {
    console.error('Error deleting row:', error);
    return NextResponse.json(
      { error: 'Failed to delete row' },
      { status: 500 },
    );
  }
}
