import { BrowserWindow, ipcMain } from 'electron';

import {
  commandRequestSchema,
  commandResponseSchema,
  type CommandError,
  type CommandRequest,
  type CommandResponse,
} from '@/shared/contracts/command';
import {
  systemLogsListEventsPayloadSchema,
  systemLogsListEventsResultSchema,
} from '@/shared/contracts/system-logs';
import {
  diagnosticsExportPayloadSchema,
  diagnosticsExportResultSchema,
} from '@/shared/contracts/diagnostics';
import {
  contactsGetDetailsPayloadSchema,
  contactsGetDetailsResultSchema,
  contactsCreatePayloadSchema,
  contactsCreateResultSchema,
  contactsUpdateCompanyPayloadSchema,
  contactsUpdateCompanyResultSchema,
} from '@/shared/contracts/contacts';
import {
  graphConnectPayloadSchema,
  graphConnectionStatusSchema,
  graphDisconnectPayloadSchema,
  graphGetConnectionStatusPayloadSchema,
} from '@/shared/contracts/graph';
import {
  recipientsSearchPayloadSchema,
  recipientsSearchResultSchema,
} from '@/shared/contracts/recipients';
import {
  guestsGetDetailsPayloadSchema,
  guestsGetDetailsResultSchema,
  guestsInvitePayloadSchema,
  guestsInviteResultSchema,
  guestsSearchPayloadSchema,
  guestsSearchResultSchema,
  guestsUpdateCompanyPayloadSchema,
  guestsUpdateCompanyResultSchema,
} from '@/shared/contracts/guests';
import {
  exchangeCapabilitiesSchema,
  exchangeConnectPayloadSchema,
  exchangeConnectionStatusSchema,
  exchangeDisconnectPayloadSchema,
  exchangeGetCapabilitiesPayloadSchema,
  exchangeGetConnectionStatusPayloadSchema,
  exchangeRecipientGetDetailsPayloadSchema,
  exchangeRecipientGetDetailsResultSchema,
  exchangeListGroupsPayloadSchema,
  exchangeListGroupsResultSchema,
  groupsAddMembersPayloadSchema,
  groupsAddMembersResultSchema,
  groupsGetMembersPayloadSchema,
  groupsGetMembersResultSchema,
  groupsRemoveMembersPayloadSchema,
  groupsRemoveMembersResultSchema,
} from '@/shared/contracts/exchange';
import {
  reportsGenerateMembershipMatrixPayloadSchema,
  reportsGenerateMembershipMatrixResultSchema,
} from '@/shared/contracts/reports';
import { addGroupMembers } from '@/main/exchange/add-group-members';
import { createContact } from '@/main/exchange/create-contact';
import { getContactDetails } from '@/main/exchange/get-contact-details';
import { getExchangeRecipientDetails } from '@/main/exchange/get-recipient-details';
import { connectExchange } from '@/main/exchange/connect-exchange';
import { disconnectExchange } from '@/main/exchange/disconnect-exchange';
import { removeGroupMembers } from '@/main/exchange/remove-group-members';
import { updateContactCompany } from '@/main/exchange/update-contact-company';
import { connectGraph } from '@/main/graph/connect-graph';
import { disconnectGraph } from '@/main/graph/disconnect-graph';
import { getGuestDetails } from '@/main/graph/get-guest-details';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { inviteGuestUser } from '@/main/graph/invite-guest-user';
import { searchGuestUsers } from '@/main/graph/search-guest-users';
import { updateGuestCompany } from '@/main/graph/update-guest-company';
import { sessionGetStatusPayloadSchema, sessionStatusSchema } from '@/shared/contracts/session';
import { getExchangeCapabilities } from '@/main/exchange/get-exchange-capabilities';
import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { getGroupMembers } from '@/main/exchange/get-group-members';
import { listExchangeGroups } from '@/main/exchange/list-exchange-groups';
import { generateMembershipMatrixReport } from '@/main/reports/generate-membership-matrix';
import { exportDiagnostics } from '@/main/ipc/handlers/export-diagnostics';
import {
  runWithOperationContext,
  readSystemLogEvents,
  writeSystemLogEvent,
  writeOperationalLog,
  type BackendOwner,
} from '@/main/logging';
import { recipientDirectory } from '@/main/recipients/recipient-directory';

import { classifyCommandError } from './classify-command-error';
import { getSessionStatus } from './handlers/get-session-status';
import { validateEventSender } from './validate-event-sender';

const COMMAND_CHANNEL = 'radapp:command';
const PROGRESS_CHANNEL = 'radapp:progress';
const MUTATION_COMMANDS = new Set([
  'groups.addMembers',
  'groups.removeMembers',
  'contacts.create',
  'contacts.updateCompany',
  'guests.invite',
  'guests.updateCompany',
]);

function createErrorResponse(requestId: string, error: CommandError): CommandResponse {
  return commandResponseSchema.parse({
    requestId,
    success: false,
    completedAt: new Date().toISOString(),
    error,
  });
}

function getBackendOwner(commandName: string): BackendOwner {
  if (
    commandName.startsWith('exchange.') ||
    commandName.startsWith('groups.') ||
    commandName.startsWith('contacts.')
  ) {
    return 'exchange';
  }

  if (commandName.startsWith('graph.') || commandName.startsWith('guests.')) {
    return 'graph';
  }

  return 'app';
}

async function logOperationEvent(input: {
  operationId: string;
  ipcRequestId: string | null;
  commandName: string;
  backendOwner: BackendOwner;
  result: 'started' | 'succeeded' | 'failed' | 'partial';
  safeErrorCode: string | null;
  message: string;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await writeOperationalLog({
      timestamp: new Date().toISOString(),
      level: input.result === 'failed' ? 'error' : input.result === 'partial' ? 'warn' : 'info',
      operationId: input.operationId,
      ipcRequestId: input.ipcRequestId,
      operationName: input.commandName,
      backendOwner: input.backendOwner,
      tenantId: input.tenantId ?? null,
      result: input.result,
      safeErrorCode: input.safeErrorCode,
      message: input.message,
      metadata: input.metadata,
    });
  } catch {
    // Logging must never affect command execution semantics.
  }
}

async function maybeWriteMutationSystemLog(
  request: CommandRequest,
  operationId: string,
  responseData: unknown,
  result: 'succeeded' | 'failed' | 'partial',
  backendOwner: BackendOwner,
): Promise<void> {
  if (!MUTATION_COMMANDS.has(request.command)) {
    return;
  }

  const exchangeStatus = await getExchangeConnectionStatus();
  const graphStatus = await getGraphConnectionStatus();
  const tenantId =
    backendOwner === 'graph'
      ? graphStatus.state === 'connected'
        ? graphStatus.tenantId
        : null
      : exchangeStatus.state === 'connected'
        ? exchangeStatus.tenantId
        : null;
  const actorUpn =
    backendOwner === 'graph'
      ? graphStatus.state === 'connected'
        ? graphStatus.accountUsername
        : null
      : exchangeStatus.state === 'connected'
        ? exchangeStatus.userPrincipalName
        : null;

  const disposition = getSystemLogDisposition(request.command, responseData, result);

  try {
    await writeSystemLogEvent({
      timestamp: new Date().toISOString(),
      operationId,
      ipcRequestId: request.requestId,
      actorUpn,
      tenantId,
      operationType: request.command,
      targetObjectType: getSystemLogTargetType(request.command, request.payload),
      targetObjectId: getSystemLogTargetId(request.command, request.payload, responseData),
      summary: getSystemLogSummary(request.command, request.payload),
      result: disposition.result,
      authoritative: disposition.authoritative,
    });
  } catch {
    // System-log persistence must never affect command execution semantics.
  }
}

function getTerminalResult(commandName: string, responseData: unknown): 'succeeded' | 'partial' {
  if (
    (commandName === 'contacts.create' || commandName === 'guests.invite') &&
    responseData &&
    typeof responseData === 'object' &&
    'outcome' in responseData &&
    (responseData as { outcome?: unknown }).outcome === 'blockedConflict'
  ) {
    return 'partial';
  }

  if (
    commandName === 'contacts.create' &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const verification = (responseData as { verification?: { companyApplied?: unknown } }).verification;
    if (verification?.companyApplied === false) {
      return 'partial';
    }
  }

  if (
    commandName === 'contacts.updateCompany' &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const verification = (responseData as { verification?: { companyApplied?: unknown } }).verification;
    if (verification?.companyApplied === false) {
      return 'partial';
    }
  }

  if (
    commandName === 'guests.invite' &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const response = responseData as {
      verification?: { foundGuest?: unknown };
      companyUpdate?: { attempted?: unknown; updated?: unknown };
    };
    if (
      response.verification?.foundGuest === false ||
      (response.companyUpdate?.attempted === true && response.companyUpdate?.updated === false)
    ) {
      return 'partial';
    }
  }

  if (
    commandName === 'guests.updateCompany' &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const verification = (responseData as {
      verification?: { foundGuest?: unknown; companyApplied?: unknown };
    }).verification;
    if (verification?.foundGuest === false || verification?.companyApplied === false) {
      return 'partial';
    }
  }

  if (
    (commandName === 'groups.addMembers' || commandName === 'groups.removeMembers') &&
    responseData &&
    typeof responseData === 'object' &&
    'summary' in responseData
  ) {
    const summary = (responseData as { summary?: Record<string, unknown> }).summary;
    const invalid = Number(summary?.invalid ?? 0);
    const failed = Number(summary?.failed ?? 0);
    const verificationFailed = Number(summary?.verificationFailed ?? 0);

    if (invalid > 0 || failed > 0 || verificationFailed > 0) {
      return 'partial';
    }
  }

  return 'succeeded';
}

function getSystemLogDisposition(
  commandName: string,
  responseData: unknown,
  result: 'succeeded' | 'failed' | 'partial',
): { result: 'succeeded' | 'failed' | 'partial'; authoritative: boolean } {
  if (result === 'failed') {
    return { result: 'failed', authoritative: false };
  }

  if (
    (commandName === 'contacts.create' || commandName === 'guests.invite') &&
    responseData &&
    typeof responseData === 'object' &&
    'outcome' in responseData &&
    (responseData as { outcome?: unknown }).outcome === 'blockedConflict'
  ) {
    return { result: 'failed', authoritative: false };
  }

  if (
    (commandName === 'contacts.create' || commandName === 'contacts.updateCompany') &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const verification = (responseData as { verification?: { companyApplied?: unknown } }).verification;
    if (verification?.companyApplied === false) {
      return { result: 'partial', authoritative: false };
    }
  }

  if (
    (commandName === 'guests.invite' || commandName === 'guests.updateCompany') &&
    responseData &&
    typeof responseData === 'object' &&
    'verification' in responseData
  ) {
    const response = responseData as {
      verification?: { foundGuest?: unknown; companyApplied?: unknown };
      companyUpdate?: { attempted?: unknown; updated?: unknown };
    };
    if (
      response.verification?.foundGuest === false ||
      response.verification?.companyApplied === false ||
      (response.companyUpdate?.attempted === true && response.companyUpdate?.updated === false)
    ) {
      return { result: 'partial', authoritative: false };
    }
  }

  return { result, authoritative: true };
}

function getSystemLogTargetType(commandName: string, payload: Record<string, unknown>): string {
  switch (commandName) {
    case 'groups.addMembers':
    case 'groups.removeMembers':
      return typeof payload.group === 'object' && payload.group && 'groupKind' in payload.group
        ? String((payload.group as { groupKind: unknown }).groupKind)
        : 'group';
    case 'contacts.create':
    case 'contacts.updateCompany':
      return 'mailContact';
    case 'guests.invite':
    case 'guests.updateCompany':
      return 'guestUser';
    default:
      return 'unknown';
  }
}

function getSystemLogTargetId(
  commandName: string,
  payload: Record<string, unknown>,
  responseData: unknown,
): string | null {
  switch (commandName) {
    case 'groups.addMembers':
    case 'groups.removeMembers':
      return typeof payload.group === 'object' && payload.group && 'exchangeIdentity' in payload.group
        ? String((payload.group as { exchangeIdentity: unknown }).exchangeIdentity)
        : null;
    case 'contacts.create':
      return typeof responseData === 'object' && responseData && 'contact' in responseData
        ? ((responseData as { contact?: { exchangeIdentity?: unknown } }).contact?.exchangeIdentity as string | undefined) ?? null
        : null;
    case 'contacts.updateCompany':
      return typeof payload.exchangeIdentity === 'string' ? payload.exchangeIdentity : null;
    case 'guests.invite':
      return typeof responseData === 'object' && responseData && 'invitedUserId' in responseData
        ? ((responseData as { invitedUserId?: unknown }).invitedUserId as string | undefined) ?? null
        : null;
    case 'guests.updateCompany':
      return typeof payload.guestUserId === 'string' ? payload.guestUserId : null;
    default:
      return null;
  }
}

function getSystemLogSummary(commandName: string, payload: Record<string, unknown>): string {
  switch (commandName) {
    case 'groups.addMembers':
      return `Attempted to add ${Array.isArray(payload.members) ? payload.members.length : 0} member(s).`;
    case 'groups.removeMembers':
      return `Attempted to remove ${Array.isArray(payload.members) ? payload.members.length : 0} member(s).`;
    case 'contacts.create':
      return 'Attempted to create a mail contact.';
    case 'contacts.updateCompany':
      return 'Attempted to update contact company.';
    case 'guests.invite':
      return 'Attempted to invite a guest user.';
    case 'guests.updateCompany':
      return 'Attempted to update guest company.';
    default:
      return 'Mutation attempted.';
  }
}

async function executeCommand(
  request: CommandRequest,
  senderWindow: BrowserWindow | null,
  emitProgress: (event: { phase: 'preflight' | 'executing' | 'verifying' | 'complete'; message: string; percent?: number }) => void,
): Promise<CommandResponse> {
  switch (request.command as string) {
    case 'systemLogs.listEvents': {
      const payload = systemLogsListEventsPayloadSchema.parse(request.payload);
      const result = systemLogsListEventsResultSchema.parse(await readSystemLogEvents(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
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
    case 'exchange.getCapabilities': {
      exchangeGetCapabilitiesPayloadSchema.parse(request.payload);
      const capabilities = exchangeCapabilitiesSchema.parse(await getExchangeCapabilities());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: capabilities,
      }) as CommandResponse;
    }
    case 'exchange.connect': {
      const payload = exchangeConnectPayloadSchema.parse(request.payload);
      const connection = exchangeConnectionStatusSchema.parse(await connectExchange(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: connection,
      }) as CommandResponse;
    }
    case 'exchange.getConnectionStatus': {
      exchangeGetConnectionStatusPayloadSchema.parse(request.payload);
      const connection = exchangeConnectionStatusSchema.parse(
        await getExchangeConnectionStatus(),
      );

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: connection,
      }) as CommandResponse;
    }
    case 'exchange.disconnect': {
      exchangeDisconnectPayloadSchema.parse(request.payload);
      const connection = exchangeConnectionStatusSchema.parse(await disconnectExchange());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: connection,
      }) as CommandResponse;
    }
    case 'exchange.listGroups': {
      const payload = exchangeListGroupsPayloadSchema.parse(request.payload);
      const result = exchangeListGroupsResultSchema.parse(await listExchangeGroups(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'exchange.getRecipientDetails': {
      const payload = exchangeRecipientGetDetailsPayloadSchema.parse(request.payload);
      const recipient = recipientDirectory.getCachedRecipientByStableKey(payload.stableKey);
      if (
        !recipient ||
        recipient.source !== 'exchange' ||
        (recipient.recipientType !== 'mailbox' && recipient.recipientType !== 'mailUser') ||
        !recipient.exchangeIdentity
      ) {
        throw new Error(
          'Exchange recipient details are only available for mailbox and mail user entries returned by the current directory search.',
        );
      }

      const result = exchangeRecipientGetDetailsResultSchema.parse(
        await getExchangeRecipientDetails(recipient.exchangeIdentity),
      );

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'groups.getMembers': {
      const payload = groupsGetMembersPayloadSchema.parse(request.payload);
      const result = groupsGetMembersResultSchema.parse(await getGroupMembers(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'groups.addMembers': {
      const payload = groupsAddMembersPayloadSchema.parse(request.payload);
      const result = groupsAddMembersResultSchema.parse(await addGroupMembers(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'groups.removeMembers': {
      const payload = groupsRemoveMembersPayloadSchema.parse(request.payload);
      const result = groupsRemoveMembersResultSchema.parse(await removeGroupMembers(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'reports.generateMembershipMatrix': {
      const payload = reportsGenerateMembershipMatrixPayloadSchema.parse(request.payload);
      const result = reportsGenerateMembershipMatrixResultSchema.parse(
        await generateMembershipMatrixReport(payload, {
          browserWindow: senderWindow,
          emitProgress,
        }),
      );

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'diagnostics.export': {
      diagnosticsExportPayloadSchema.parse(request.payload);
      const result = diagnosticsExportResultSchema.parse(await exportDiagnostics(senderWindow));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'recipients.search': {
      const payload = recipientsSearchPayloadSchema.parse(request.payload);
      const result = recipientsSearchResultSchema.parse(await recipientDirectory.searchRecipients(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'graph.connect': {
      graphConnectPayloadSchema.parse(request.payload);
      const result = graphConnectionStatusSchema.parse(await connectGraph());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'graph.getConnectionStatus': {
      graphGetConnectionStatusPayloadSchema.parse(request.payload);
      const result = graphConnectionStatusSchema.parse(await getGraphConnectionStatus());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'graph.disconnect': {
      graphDisconnectPayloadSchema.parse(request.payload);
      const result = graphConnectionStatusSchema.parse(await disconnectGraph());

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'guests.search': {
      const payload = guestsSearchPayloadSchema.parse(request.payload);
      const result = guestsSearchResultSchema.parse(await searchGuestUsers(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'guests.getDetails': {
      const payload = guestsGetDetailsPayloadSchema.parse(request.payload);
      const recipient = recipientDirectory.getCachedRecipientByStableKey(payload.stableKey);
      if (
        !recipient ||
        recipient.source !== 'graph' ||
        recipient.recipientType !== 'guestUser' ||
        !recipient.objectId
      ) {
        throw new Error('Guest details are only available for guest entries returned by the current directory search.');
      }

      const result = guestsGetDetailsResultSchema.parse(
        await getGuestDetails(recipient.objectId),
      );

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'guests.invite': {
      const payload = guestsInvitePayloadSchema.parse(request.payload);
      const result = guestsInviteResultSchema.parse(await inviteGuestUser(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'guests.updateCompany': {
      const payload = guestsUpdateCompanyPayloadSchema.parse(request.payload);
      const result = guestsUpdateCompanyResultSchema.parse(await updateGuestCompany(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'contacts.getDetails': {
      const payload = contactsGetDetailsPayloadSchema.parse(request.payload);
      const recipient = recipientDirectory.getCachedRecipientByStableKey(payload.stableKey);
      if (
        !recipient ||
        recipient.source !== 'exchange' ||
        recipient.recipientType !== 'mailContact' ||
        !recipient.exchangeIdentity
      ) {
        throw new Error('Contact details are only available for contact entries returned by the current directory search.');
      }

      const result = contactsGetDetailsResultSchema.parse(
        await getContactDetails(recipient.exchangeIdentity),
      );

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'contacts.create': {
      const payload = contactsCreatePayloadSchema.parse(request.payload);
      const result = contactsCreateResultSchema.parse(await createContact(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    case 'contacts.updateCompany': {
      const payload = contactsUpdateCompanyPayloadSchema.parse(request.payload);
      const result = contactsUpdateCompanyResultSchema.parse(await updateContactCompany(payload));

      return commandResponseSchema.parse({
        requestId: request.requestId,
        success: true,
        completedAt: new Date().toISOString(),
        data: result,
      }) as CommandResponse;
    }
    default: {
      throw new Error(`Unknown command: ${request.command}`);
    }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(COMMAND_CHANNEL, async (event, rawRequest) => {
    let parsedRequest: CommandRequest | null = null;
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
      const operationId = crypto.randomUUID();
      await logOperationEvent({
        operationId,
        ipcRequestId: fallbackRequestId,
        commandName:
          requestRecord?.command && typeof requestRecord.command === 'string'
            ? requestRecord.command
            : 'unknown',
        backendOwner: 'app',
        result: 'failed',
        safeErrorCode: 'unauthorized_sender',
        message: 'IPC sender was rejected by the application security policy.',
      });

      const commandName =
        requestRecord?.command && typeof requestRecord.command === 'string'
          ? requestRecord.command
          : 'unknown';

      return createErrorResponse(fallbackRequestId, {
        code: 'unauthorized_sender',
        message: 'IPC sender was rejected by the application security policy.',
        retryable: false,
        classification: {
          category: 'authorizationFailure',
          remediation: 'contactAdministrator',
          backend: 'app',
          operation: commandName,
          guidance: 'Use the trusted application window and contact an administrator if the policy block persists.',
        },
      });
    }

    const operationId = crypto.randomUUID();

    try {
      const request = commandRequestSchema.parse(rawRequest);
      parsedRequest = request;
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const backendOwner = getBackendOwner(request.command);

      return await runWithOperationContext(
        {
          operationId,
          ipcRequestId: request.requestId,
          commandName: request.command,
          backendOwner,
        },
        async () => {
          await logOperationEvent({
            operationId,
            ipcRequestId: request.requestId,
            commandName: request.command,
            backendOwner,
            result: 'started',
            safeErrorCode: null,
            message: `Started ${request.command}.`,
          });

          const response = await executeCommand(request, senderWindow, (progress) => {
            void logOperationEvent({
              operationId,
              ipcRequestId: request.requestId,
              commandName: request.command,
              backendOwner,
              result: progress.phase === 'complete' ? 'succeeded' : 'partial',
              safeErrorCode: null,
              message: progress.message,
              metadata: {
                phase: progress.phase,
                percent: progress.percent ?? null,
              },
            });

            event.sender.send(PROGRESS_CHANNEL, {
              ...progress,
              requestId: request.requestId,
            });
          });

          const terminalResult = getTerminalResult(request.command, response.data);

          await logOperationEvent({
            operationId,
            ipcRequestId: request.requestId,
            commandName: request.command,
            backendOwner,
            result: terminalResult,
            safeErrorCode: null,
            message: `Completed ${request.command}.`,
          });
          await maybeWriteMutationSystemLog(request, operationId, response.data, terminalResult, backendOwner);

          return response;
        },
      );
    } catch (error) {
      const commandName =
        requestRecord?.command && typeof requestRecord.command === 'string'
          ? requestRecord.command
          : 'unknown';
      const backendOwner =
        requestRecord?.command && typeof requestRecord.command === 'string'
          ? getBackendOwner(requestRecord.command)
          : 'app';
      const classifiedError = classifyCommandError({
        commandName,
        backendOwner,
        error,
      });
      const classifiedBackendOwner = classifiedError.classification.backend;

      await logOperationEvent({
        operationId,
        ipcRequestId: fallbackRequestId,
        commandName,
        backendOwner: classifiedBackendOwner,
        result: 'failed',
        safeErrorCode: classifiedError.code,
        message: classifiedError.message,
        metadata: {
          category: classifiedError.classification.category,
          remediation: classifiedError.classification.remediation,
          backendCode: classifiedError.classification.backendCode ?? null,
          statusCode: classifiedError.classification.statusCode ?? null,
        },
      });

      if (parsedRequest) {
        await maybeWriteMutationSystemLog(
          parsedRequest,
          operationId,
          null,
          'failed',
          classifiedBackendOwner,
        );
      }

      return createErrorResponse(fallbackRequestId, classifiedError);
    }
  });
}
