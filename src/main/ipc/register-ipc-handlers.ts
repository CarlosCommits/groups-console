import { ipcMain } from 'electron';

import {
  commandRequestSchema,
  commandResponseSchema,
  type CommandError,
  type CommandRequest,
  type CommandResponse,
} from '@/shared/contracts/command';
import { sessionGetStatusPayloadSchema, sessionStatusSchema } from '@/shared/contracts/session';

import { getSessionStatus } from './handlers/get-session-status';
import { validateEventSender } from './validate-event-sender';

const COMMAND_CHANNEL = 'radapp:command';

function createErrorResponse(requestId: string, error: CommandError): CommandResponse {
  return commandResponseSchema.parse({
    requestId,
    success: false,
    completedAt: new Date().toISOString(),
    error,
  });
}

async function executeCommand(request: CommandRequest): Promise<CommandResponse> {
  switch (request.command) {
    case 'session.getStatus': {
      sessionGetStatusPayloadSchema.parse(request.payload);
      const status = sessionStatusSchema.parse(await getSessionStatus());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: status,
      }) as CommandResponse;
    }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(COMMAND_CHANNEL, async (event, rawRequest) => {
    const requestRecord =
      typeof rawRequest === 'object' && rawRequest !== null
        ? (rawRequest as Record<string, unknown>)
        : null;
    const maybeRequestId = requestRecord?.requestId;
    const fallbackRequestId =
      typeof maybeRequestId === 'string' || typeof maybeRequestId === 'number'
        ? String(maybeRequestId)
        : 'unknown-request';

    if (!validateEventSender(event)) {
      return createErrorResponse(fallbackRequestId, {
        code: 'unauthorized_sender',
        message: 'IPC sender was rejected by the application security policy.',
        retryable: false,
      });
    }

    try {
      const request = commandRequestSchema.parse(rawRequest);
      return await executeCommand(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown command failure.';

      return createErrorResponse(fallbackRequestId, {
        code: 'command_failed',
        message,
        retryable: false,
      });
    }
  });
}
