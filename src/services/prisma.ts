import { PrismaClient, Prisma } from '../../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configurações do Prisma Client - Arrays de log tipados explicitamente
const productionLog: Prisma.LogLevel[] = ['error', 'warn'];
const developmentLog: Prisma.LogLevel[] = ['query', 'error', 'warn'];

const getPrismaConfig = () => ({
  log: process.env.NODE_ENV === 'production' ? productionLog : developmentLog,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Função para inicializar o Prisma Client de forma lazy (apenas quando necessário)
function initializePrisma(): PrismaClient {
  // Verificar se já existe no global (dev mode) ou criar nova instância
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient(getPrismaConfig());
  }
  return globalForPrisma.prisma;
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
  const client = initializePrisma();
  try {
    await client.$disconnect();
  } catch {
    // Ignorar erros ao desconectar
  }

  // Criar nova instância
  globalForPrisma.prisma = new PrismaClient(getPrismaConfig());

  // Testar conexão
  try {
    await globalForPrisma.prisma.$connect();
  } catch {
    // Se ainda não conseguir conectar, aguardar um pouco antes de tentar novamente
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await globalForPrisma.prisma.$connect();
  }
}

// Middleware para retry automático em caso de erros de conexão
// Configurar o middleware apenas quando o Prisma for inicializado (lazy)
let middlewareConfigured = false;

function configurePrismaMiddleware() {
  if (middlewareConfigured) return;

  // Só configurar em runtime, não durante build
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    try {
      const client = initializePrisma();
      client.$use(async (params, next) => {
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
      middlewareConfigured = true;
    } catch (error) {
      // Silenciosamente ignorar erros durante build/test
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to configure Prisma middleware:', error);
      }
    }
  }
}

// Criar um proxy que inicializa o Prisma apenas quando acessado (lazy initialization)
// Isso evita que o Prisma seja inicializado durante o build
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // Configurar middleware na primeira vez que o Prisma for acessado
    configurePrismaMiddleware();
    const client = initializePrisma();
    const value = client[prop as keyof PrismaClient];
    // Se for uma função, fazer bind ao client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Exportar o proxy como prisma
const prisma = prismaProxy;

// Graceful shutdown para evitar broken pipes
let isDisconnecting = false;

async function gracefulDisconnect(): Promise<void> {
  if (isDisconnecting) return;
  isDisconnecting = true;

  try {
    const client = globalForPrisma.prisma;
    if (client) {
      await client.$disconnect();
    }
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

// Exportar o proxy como prisma
export { prisma };
