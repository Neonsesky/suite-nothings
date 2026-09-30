import type { GasEnv } from './gas-harness/index.mjs';

export interface MockServer {
  /** http://127.0.0.1:<port> */
  url: string;
  port: number;
  /** `${url}/macros/s/<id>/exec` (default id MOCK). */
  execUrl(id?: string): string;
  env(): GasEnv;
  close(): Promise<void>;
}

export function startMockServer(options?: { port?: number; key?: string; verbose?: boolean; host?: string }): Promise<MockServer>;
