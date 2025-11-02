/**
 * React Query Provider
 *
 * Provider principal com:
 * - Configuração otimizada
 * - Error handling
 * - Persistent cache (opcional)
 * - Cross-tab synchronization
 */

'use client';

import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '@/lib/react-query/config';
import {
  createPersister,
  clearOldCache,
  CrossTabSync,
} from '@/lib/react-query/persistent-cache';
import { ErrorBoundary } from './error-boundary';

interface ReactQueryProviderProps {
  children: React.ReactNode;
  /**
   * Habilitar cache persistente (localStorage)
   * @default false
   */
  enablePersistence?: boolean;
  /**
   * Tipo de armazenamento para cache persistente
   * @default 'local'
   */
  storageType?: 'local' | 'session';
  /**
   * Habilitar sincronização entre abas
   * @default true
   */
  enableCrossTabSync?: boolean;
}

/**
 * Provider com cache persistente
 */
function PersistentQueryProvider({
  children,
  storageType = 'local',
}: {
  children: React.ReactNode;
  storageType?: 'local' | 'session';
}) {
  const persister = createPersister(storageType);

  useEffect(() => {
    // Limpar cache antigo no startup
    clearOldCache();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        buster: '', // Incrementar para invalidar todo cache
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * Provider sem cache persistente
 */
function StandardQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Provider principal
 */
export function ReactQueryProvider({
  children,
  enablePersistence = false,
  storageType = 'local',
  enableCrossTabSync = true,
}: ReactQueryProviderProps) {
  // Cross-tab synchronization
  useEffect(() => {
    if (!enableCrossTabSync) return;

    const sync = new CrossTabSync(queryClient);

    return () => {
      sync.close();
    };
  }, [enableCrossTabSync]);

  const Provider = enablePersistence
    ? PersistentQueryProvider
    : StandardQueryProvider;

  return (
    <ErrorBoundary>
      <Provider storageType={storageType}>{children}</Provider>
    </ErrorBoundary>
  );
}

/**
 * Backward compatibility
 * Exportar também como QueryProvider
 */
export { ReactQueryProvider as QueryProvider };
