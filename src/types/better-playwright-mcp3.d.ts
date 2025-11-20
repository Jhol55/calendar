/**
 * Type declarations for better-playwright-mcp3
 * This file provides minimal type definitions for the library
 */

declare module 'better-playwright-mcp3/lib/loopTools/context.js' {
  import type {
    Browser,
    BrowserContext as PlaywrightBrowserContext,
  } from 'playwright';

  export interface ContextConfig {
    apiKey?: string;
    model?: string;
    browser?: Browser;
    browserContext?: PlaywrightBrowserContext;
    headless?: boolean;
    continueOnError?: boolean;
    maxRetries?: number;
    logging?: boolean;
    remoteEndpoint?: string;
  }

  export interface TaskResult {
    success?: boolean;
    result?: string;
    error?: string;
    actions?: Array<{
      action: string;
      selector?: string;
      value?: string;
      text?: string;
    }>;
  }

  export class Context {
    static create(config: ContextConfig): Promise<Context>;
    runTask(task: string, oneShot?: boolean): Promise<string>;
    close(): Promise<void>;
  }
}
