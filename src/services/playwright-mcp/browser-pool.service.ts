/**
 * Browser Pool Manager
 * Gerencia pool de browsers reutilizáveis para otimizar recursos
 *
 * Estratégia:
 * - Lazy loading: Browsers criados sob demanda
 * - Máximo de N browsers simultâneos (configurável)
 * - Reuso: Browsers retornam ao pool após uso
 * - Cleanup: Browsers inativos fechados após timeout
 */

import type { Browser } from 'playwright';

interface BrowserInstance {
  id: string;
  browser: Browser;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

export class BrowserPoolManager {
  private pool: BrowserInstance[] = [];
  private maxPoolSize: number;
  private browserMaxAgeMs: number;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(maxPoolSize = 10, browserMaxAgeMs = 60 * 60 * 1000) {
    this.maxPoolSize = maxPoolSize;
    this.browserMaxAgeMs = browserMaxAgeMs;

    // Iniciar cleanup periódico (a cada 5 minutos)
    this.startCleanupInterval();
  }

  /**
   * Adquire um browser do pool ou cria um novo
   */
  async acquireBrowser(): Promise<{ browser: Browser; browserId: string }> {
    // 1. Tentar pegar browser disponível do pool
    const available = this.pool.find((b) => !b.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsedAt = new Date();

      // Verificar se browser ainda está conectado
      if (!available.browser.isConnected()) {
        // Browser desconectado, remover do pool e criar novo
        await this.removeBrowserFromPool(available.id);
        return this.acquireBrowser(); // Recursão para pegar outro
      }

      return { browser: available.browser, browserId: available.id };
    }

    // 2. Se pool não está cheio, criar novo browser
    if (this.pool.length < this.maxPoolSize) {
      const browser = await this.createNewBrowser();
      const browserId = this.generateBrowserId();

      const instance: BrowserInstance = {
        id: browserId,
        browser,
        inUse: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      this.pool.push(instance);
      return { browser, browserId };
    }

    // 3. Pool cheio e nenhum browser disponível - esperar
    // Aguardar até que algum browser seja liberado
    await this.waitForAvailableBrowser();
    return this.acquireBrowser(); // Tentar novamente
  }

  /**
   * Libera um browser de volta ao pool
   */
  async releaseBrowser(browserId: string): Promise<void> {
    const instance = this.pool.find((b) => b.id === browserId);

    if (!instance) {
      console.warn(`[BrowserPool] Browser ${browserId} não encontrado no pool`);
      return;
    }

    try {
      // Limpar contextos e páginas antes de retornar ao pool
      const contexts = instance.browser.contexts();
      for (const context of contexts) {
        await context.close();
      }

      instance.inUse = false;
      instance.lastUsedAt = new Date();
    } catch (error) {
      // Se houver erro na limpeza, remover browser do pool
      console.error(
        `[BrowserPool] Erro ao limpar browser ${browserId}:`,
        error,
      );
      await this.removeBrowserFromPool(browserId);
    }
  }

  /**
   * Cria um novo browser
   */
  private async createNewBrowser(): Promise<Browser> {
    const pw = await import('playwright');
    const { chromium } = pw;

    return await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-infobars',
        '--window-size=1920,1080',
      ],
    });
  }

  /**
   * Remove browser do pool e fecha
   */
  private async removeBrowserFromPool(browserId: string): Promise<void> {
    const index = this.pool.findIndex((b) => b.id === browserId);

    if (index === -1) return;

    const instance = this.pool[index];

    try {
      if (instance.browser.isConnected()) {
        await instance.browser.close();
      }
    } catch (error) {
      console.error(
        `[BrowserPool] Erro ao fechar browser ${browserId}:`,
        error,
      );
    }

    this.pool.splice(index, 1);
  }

  /**
   * Aguarda até que um browser fique disponível
   */
  private async waitForAvailableBrowser(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const hasAvailable = this.pool.some((b) => !b.inUse);
        if (hasAvailable) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100); // Verificar a cada 100ms

      // Timeout de segurança (30 segundos)
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  /**
   * Cleanup periódico de browsers inativos
   */
  private startCleanupInterval(): void {
    // Executar cleanup a cada 5 minutos
    this.cleanupIntervalId = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Fecha browsers inativos há muito tempo
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const browsersToRemove: string[] = [];

    for (const instance of this.pool) {
      // Não remover browsers em uso
      if (instance.inUse) continue;

      // Remover browsers antigos ou desconectados
      const age = now.getTime() - instance.lastUsedAt.getTime();
      const isOld = age > this.browserMaxAgeMs;
      const isDisconnected = !instance.browser.isConnected();

      if (isOld || isDisconnected) {
        browsersToRemove.push(instance.id);
      }
    }

    // Remover browsers identificados
    for (const browserId of browsersToRemove) {
      await this.removeBrowserFromPool(browserId);
    }

    if (browsersToRemove.length > 0) {
      console.log(
        `[BrowserPool] Cleanup: ${browsersToRemove.length} browser(s) removido(s)`,
      );
    }
  }

  /**
   * Fecha todos os browsers e para o cleanup
   */
  async shutdown(): Promise<void> {
    // Parar cleanup periódico
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Fechar todos os browsers
    const closePromises = this.pool.map((instance) =>
      this.removeBrowserFromPool(instance.id),
    );

    await Promise.all(closePromises);
    this.pool = [];

    console.log('[BrowserPool] Shutdown completo');
  }

  /**
   * Gera ID único para browser
   */
  private generateBrowserId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Retorna estatísticas do pool
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    maxSize: number;
  } {
    const inUse = this.pool.filter((b) => b.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      maxSize: this.maxPoolSize,
    };
  }
}

// Singleton instance
let poolInstance: BrowserPoolManager | null = null;

/**
 * Retorna instância singleton do pool
 */
export function getBrowserPool(): BrowserPoolManager {
  if (!poolInstance) {
    const maxPoolSize = parseInt(process.env.MAX_POOL_SIZE || '10', 10);
    const browserMaxAgeMs = parseInt(
      process.env.BROWSER_MAX_AGE_MS || String(60 * 60 * 1000),
      10,
    );

    poolInstance = new BrowserPoolManager(maxPoolSize, browserMaxAgeMs);
  }

  return poolInstance;
}
