import { commandErrorSchema, type CommandError } from '@/shared/contracts/command';

export class CommandFailure extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: string;
  readonly classification: CommandError['classification'];

  constructor(error: CommandError) {
    super(error.message);
    this.name = 'CommandFailure';
    this.code = error.code;
    this.retryable = error.retryable;
    this.details = error.details;
    this.classification = error.classification;
  }
}

export function createCommandFailure(
  error: CommandError | undefined,
  fallbackMessage: string,
): CommandFailure {
  const parsedError = commandErrorSchema.parse(
    error ?? {
      code: 'app_unknown_failure',
      message: fallbackMessage,
      retryable: false,
      classification: {
        category: 'unknownFailure',
        remediation: 'retryFromFreshState',
        backend: 'app',
        operation: 'unknown',
        guidance:
          'Retry from a fresh application state. If the problem persists, export diagnostics and contact an administrator.',
      },
    },
  );

  return new CommandFailure(parsedError);
}
