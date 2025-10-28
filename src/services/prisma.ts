import { PrismaClient } from '../../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

// Flag para garantir que os listeners sejam adicionados apenas uma vez
const globalForListeners = globalThis as unknown as {
  prismaListenersAdded?: boolean;
};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = globalForPrisma.prisma;
}

// Graceful shutdown para evitar broken pipes
// Adiciona listeners apenas uma vez, mesmo com hot-reload
if (!globalForListeners.prismaListenersAdded) {
  globalForListeners.prismaListenersAdded = true;

  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

export { prisma };
