/// <reference types="vite/client" />

import type { SessionStatusSchema } from "@/shared/contracts/session";

declare global {
  interface Window {
    radApp: {
      session: {
        getStatus: () => Promise<SessionStatusSchema>;
      };
    };
  }
}
