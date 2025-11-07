/**
 * Persistent Cache para React Query
 *
 * Persistir cache no localStorage/sessionStorage para melhor UX
 * - Dados sobrevivem a reloads
 * - Sincronização entre abas
 * - Invalidação automática de dados antigos
 */

import {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Configurações de persistência
 */
export const PERSIST_CONFIG = {
  key: 'react-query-cache',
  version: 1,
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  buster: '', // Mudar para invalidar todo cache
} as const;

/**
 * Persister customizado usando localStorage
 */
export class LocalStoragePersister implements Persister {
  private readonly storageKey: string;
  private readonly maxAge: number;

  constructor(config: { key: string; maxAge: number }) {
    this.storageKey = config.key;
    this.maxAge = config.maxAge;
  }

  async persistClient(client: PersistedClient): Promise<void> {
    try {
      const data = {
        clientState: client,
        timestamp: Date.now(),
        version: PERSIST_CONFIG.version,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist query cache:', error);
      // Limpar localStorage se estiver cheio
      this.clearOldEntries();
    }
  }

  async restoreClient(): Promise<PersistedClient | undefined> {
    try {
      const stored = localStorage.getItem(this.storageKey);

      if (!stored) {
        return undefined;
      }

      const data = JSON.parse(stored);

      // Verificar versão
      if (data.version !== PERSIST_CONFIG.version) {
        this.removeClient();
        return undefined;
      }

      // Verificar idade
      const age = Date.now() - data.timestamp;
      if (age > this.maxAge) {
        this.removeClient();
        return undefined;
      }

      return data.clientState;
    } catch (error) {
      console.warn('Failed to restore query cache:', error);
      this.removeClient();
      return undefined;
    }
  }

  async removeClient(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to remove query cache:', error);
    }
  }

  private clearOldEntries(): void {
    // Remover entradas antigas do localStorage se estiver cheio
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('react-query-')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clear old entries:', error);
    }
  }
}

/**
 * Persister usando sessionStorage (dados apenas durante sessão)
 */
export class SessionStoragePersister implements Persister {
  private readonly storageKey: string;

  constructor(config: { key: string }) {
    this.storageKey = config.key;
  }

  async persistClient(client: PersistedClient): Promise<void> {
    try {
      const data = {
        clientState: client,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist to session storage:', error);
    }
  }

  async restoreClient(): Promise<PersistedClient | undefined> {
    try {
      const stored = sessionStorage.getItem(this.storageKey);

      if (!stored) {
        return undefined;
      }

      const data = JSON.parse(stored);
      return data.clientState;
    } catch (error) {
      console.warn('Failed to restore from session storage:', error);
      this.removeClient();
      return undefined;
    }
  }

  async removeClient(): Promise<void> {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to remove from session storage:', error);
    }
  }
}

/**
 * Criar persister baseado em tipo de armazenamento
 */
export function createPersister(
  type: 'local' | 'session' = 'local',
): Persister {
  if (typeof window === 'undefined') {
    // No SSR, retornar persister dummy
    return {
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {},
    };
  }

  if (type === 'session') {
    return new SessionStoragePersister({
      key: PERSIST_CONFIG.key,
    });
  }

  return new LocalStoragePersister({
    key: PERSIST_CONFIG.key,
    maxAge: PERSIST_CONFIG.maxAge,
  });
}

/**
 * Sincronização entre abas
 */
export class CrossTabSync {
  private queryClient: QueryClient;
  private readonly channel: BroadcastChannel | null;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;

    // BroadcastChannel para sync entre abas
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('react-query-sync');
      this.setupListeners();
    } else {
      this.channel = null;
    }
  }

  private setupListeners(): void {
    if (!this.channel) return;

    this.channel.addEventListener('message', (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'invalidate':
          this.queryClient.invalidateQueries({ queryKey: payload.queryKey });
          break;

        case 'refetch':
          this.queryClient.refetchQueries({ queryKey: payload.queryKey });
          break;

        case 'clear':
          this.queryClient.clear();
          break;
      }
    });
  }

  invalidate(queryKey: QueryKey): void {
    this.channel?.postMessage({
      type: 'invalidate',
      payload: { queryKey },
    });
  }

  refetch(queryKey: QueryKey): void {
    this.channel?.postMessage({
      type: 'refetch',
      payload: { queryKey },
    });
  }

  clear(): void {
    this.channel?.postMessage({
      type: 'clear',
    });
  }

  close(): void {
    this.channel?.close();
  }
}

/**
 * Limpar cache antigo no startup
 */
export function clearOldCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(PERSIST_CONFIG.key);

    if (!stored) return;

    const data = JSON.parse(stored);
    const age = Date.now() - (data.timestamp || 0);

    // Limpar se mais velho que maxAge
    if (age > PERSIST_CONFIG.maxAge) {
      localStorage.removeItem(PERSIST_CONFIG.key);
    }
  } catch {
    // Limpar em caso de erro
    localStorage.removeItem(PERSIST_CONFIG.key);
  }
}

/**
 * Utilidade para invalidar todo cache persistido
 */
export function bustPersistentCache(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(PERSIST_CONFIG.key);
    sessionStorage.removeItem(PERSIST_CONFIG.key);
  } catch (error) {
    console.warn('Failed to bust cache:', error);
  }
}
