import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { email, admintoken } = requestData;

    if (!email || !admintoken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Primeiro, tentar buscar do PostgreSQL
    try {
      const instances = await prisma.instances.findMany({
        where: {
          adminField01: email,
        },
      });

      if (instances && instances.length > 0) {
        console.log(
          `Found ${instances.length} instances in PostgreSQL for ${email}`,
        );
        return NextResponse.json(instances);
      }

      console.log('No instances found in PostgreSQL, falling back to UAZAPI');
    } catch (dbError) {
      console.error(
        'Error fetching from PostgreSQL, falling back to UAZAPI:',
        dbError,
      );
    }

    // Fallback: buscar da UAZAPI
    const response = await fetch(`${process.env.UAZAPI_URL}/instance/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        admintoken: `${process.env.UAZAPI_ADMIN_TOKEN}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    // Garantir que data é um array
    const instancesArray = Array.isArray(data) ? data : [];

    const filteredData = instancesArray.filter(
      (item: { adminField01: string }) => item.adminField01 === email,
    );

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('Error fetching instances:', error);
    return NextResponse.json([]);
  }
}
