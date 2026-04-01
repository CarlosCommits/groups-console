import { type CommandName, commandRequestSchema, type CommandRequest } from '@/shared/contracts/command';

export function createCommandRequest<TPayload extends Record<string, unknown>>(
  command: CommandName,
  payload: TPayload,
): CommandRequest {
  return commandRequestSchema.parse({
    requestId: crypto.randomUUID(),
    command,
    issuedAt: new Date().toISOString(),
    payload,
  });
}
