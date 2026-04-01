import type { ExchangeCapabilities } from '@/shared/contracts/exchange';
import type { SessionStatusSchema } from '@/shared/contracts/session';

declare global {
  interface Window {
    radApp: {
      session: {
        getStatus: () => Promise<SessionStatusSchema>;
      };
      exchange: {
        getCapabilities: () => Promise<ExchangeCapabilities>;
      };
    };
  }
}

export {};
