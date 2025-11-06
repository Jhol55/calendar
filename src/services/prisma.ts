import { PrismaClient } from '../../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

// Configurações do Prisma Client
const prismaConfig = {
  log:
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaConfig);
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient(prismaConfig);
  }
  prisma = globalForPrisma.prisma;
}

// Função auxiliar para verificar se é erro de conexão
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const errorMessage = error.message.toLowerCase();
  const errorCode = (error as { code?: string }).code;

  return (
    errorMessage.includes('connection') ||
    errorMessage.includes('broken pipe') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('the database system is starting up') ||
    errorMessage.includes('connection terminated') ||
    errorMessage.includes('server closed the connection') ||
    errorCode === 'P1001' || // Prisma connection error
    errorCode === 'P1008' || // Prisma operation timed out
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT'
  );
}

// Função para reconectar em caso de erro de conexão
async function reconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignorar erros ao desconectar
  }

  // Criar nova instância
  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient(prismaConfig);
  } else {
    globalForPrisma.prisma = new PrismaClient(prismaConfig);
    prisma = globalForPrisma.prisma;
  }

  // Testar conexão
  try {
    await prisma.$connect();
  } catch (connectError: unknown) {
    // Se ainda não conseguir conectar, aguardar um pouco antes de tentar novamente
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await prisma.$connect();
  }
}

// Middleware para retry automático em caso de erros de conexão
prisma.$use(async (params, next) => {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await next(params);
    } catch (error: unknown) {
      lastError = error;

      // Se não for erro de conexão, lançar imediatamente
      if (!isConnectionError(error)) {
        throw error;
      }

      // Se for erro de conexão e ainda temos tentativas
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * attempt, 5000); // Backoff exponencial, máximo 5s
        console.warn(
          `⚠️ Erro de conexão detectado (tentativa ${attempt}/${maxRetries}), aguardando ${waitTime}ms antes de reconectar...`,
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));

        try {
          await reconnectPrisma();
        } catch (reconnectError: unknown) {
          const reconnectErrorMessage =
            reconnectError instanceof Error
              ? reconnectError.message
              : String(reconnectError);
          console.error(
            `❌ Falha ao reconectar (tentativa ${attempt}):`,
            reconnectErrorMessage,
          );

          // Se for a última tentativa, lançar o erro
          if (attempt === maxRetries) {
            throw reconnectError;
          }
        }
      } else {
        // Última tentativa falhou
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          '❌ Falha ao reconectar após todas as tentativas:',
          errorMessage,
        );
        throw error;
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  throw lastError;
});

// Graceful shutdown para evitar broken pipes
let isDisconnecting = false;

async function gracefulDisconnect(): Promise<void> {
  if (isDisconnecting) return;
  isDisconnecting = true;

  try {
    await prisma.$disconnect();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Não logar erros de desconexão durante shutdown, é esperado
    if (
      !errorMessage.includes('disconnect') &&
      !errorMessage.includes('closed')
    ) {
      console.error('Erro ao desconectar Prisma:', errorMessage);
    }
  }
}

process.on('beforeExit', async () => {
  await gracefulDisconnect();
});

process.on('SIGINT', async () => {
  await gracefulDisconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await gracefulDisconnect();
  process.exit(0);
});

export { prisma };
