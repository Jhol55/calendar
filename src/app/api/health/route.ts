import { NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

/**
 * Health Check Endpoint
 * Usado pelo Docker e monitoramento para verificar se a aplicação está funcionando
 */
export async function GET() {
  try {
    // Verificar conexão com o banco de dados
    await prisma.$queryRaw`SELECT 1`;

    // Verificar variáveis de ambiente críticas
    const requiredEnvVars = ['DATABASE_URL', 'SECRET_KEY'];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Missing required environment variables',
          missing: missingEnvVars,
        },
        { status: 500 },
      );
    }

    // Retornar status saudável
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '0.1.0',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
