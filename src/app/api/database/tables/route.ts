import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 },
      );
    }

    // Buscar todas as tabelas únicas do usuário
    const tables = await prisma.dataTable.findMany({
      where: {
        userId,
      },
      select: {
        tableName: true,
      },
      distinct: ['tableName'],
    });

    const tableNames = tables.map((t) => t.tableName);

    return NextResponse.json({ tables: tableNames });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 },
    );
  }
}
