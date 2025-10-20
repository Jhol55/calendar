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
    const allData: any[] = [];
    dataRecords.forEach((record) => {
      const data = record.data as any;
      if (Array.isArray(data)) {
        allData.push(...data);
      }
    });

    return NextResponse.json({
      data: allData,
      schema,
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table data' },
      { status: 500 },
    );
  }
}
