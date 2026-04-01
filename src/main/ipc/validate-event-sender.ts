import type { IpcMainInvokeEvent } from 'electron';

import { isPackagedRuntime } from '@/main/app/runtime-mode';

import { isTrustedWebContents } from './trusted-senders';

export function validateEventSender(event: IpcMainInvokeEvent): boolean {
  const senderUrl = event.senderFrame?.url;

  if (!senderUrl || !isTrustedWebContents(event.sender.id)) {
    return false;
  }

  if (!isPackagedRuntime()) {
    return senderUrl.startsWith('http://localhost:5173');
  }

  return senderUrl.startsWith('file://');
}
