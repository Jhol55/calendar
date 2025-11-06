import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tableName = searchParams.get('tableName');

    if (!userId || !tableName) {
      return NextResponse.json(
        { error: 'userId and tableName are required' },
        { status: 400 },
      );
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
      orderBy: {
        partition: 'asc',
      },
    });

    if (dataRecords.length === 0) {
      return NextResponse.json({
        data: [],
        schema: null,
      });
    }

    // Pegar o schema da primeira partição
    const schema = dataRecords[0].schema;

    // Extrair todos os dados (campo data é JSONB com array)
    const allData: Record<string, unknown>[] = [];
    dataRecords.forEach((record) => {
      const data = record.data;
      if (Array.isArray(data)) {
        allData.push(...(data as Record<string, unknown>[]));
      }
    });

    return NextResponse.json({
      data: allData,
      schema,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch table data';
    console.error('Error fetching table data:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
