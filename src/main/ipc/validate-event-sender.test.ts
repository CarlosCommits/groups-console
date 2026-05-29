import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

import { clearTrustedWebContents, registerTrustedWebContents } from './trusted-senders';
import { validateEventSender } from './validate-event-sender';

describe('validateEventSender', () => {
  afterEach(() => {
    clearTrustedWebContents();
  });

  it('accepts a trusted localhost sender in development', () => {
    registerTrustedWebContents(11);

    const result = validateEventSender({
      sender: { id: 11 },
      senderFrame: { url: 'http://localhost:5173/' },
    } as never);

    expect(result).toBe(true);
  });

  it('rejects an untrusted sender even if the url matches', () => {
    const result = validateEventSender({
      sender: { id: 99 },
      senderFrame: { url: 'http://localhost:5173/' },
    } as never);

    expect(result).toBe(false);
  });
});
