import { ipcMain } from 'electron';

import {
  commandRequestSchema,
  commandResponseSchema,
  type CommandError,
  type CommandRequest,
  type CommandResponse,
} from '@/shared/contracts/command';
import {
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
  exchangeListGroupsPayloadSchema,
  exchangeListGroupsResultSchema,
  groupsAddMembersPayloadSchema,
  groupsAddMembersResultSchema,
  groupsGetMembersPayloadSchema,
  groupsGetMembersResultSchema,
  groupsRemoveMembersPayloadSchema,
  groupsRemoveMembersResultSchema,
} from '@/shared/contracts/exchange';
import { addGroupMembers } from '@/main/exchange/add-group-members';
import { createContact } from '@/main/exchange/create-contact';
import { connectExchange } from '@/main/exchange/connect-exchange';
import { disconnectExchange } from '@/main/exchange/disconnect-exchange';
import { removeGroupMembers } from '@/main/exchange/remove-group-members';
import { updateContactCompany } from '@/main/exchange/update-contact-company';
import { connectGraph } from '@/main/graph/connect-graph';
import { disconnectGraph } from '@/main/graph/disconnect-graph';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { inviteGuestUser } from '@/main/graph/invite-guest-user';
import { searchGuestUsers } from '@/main/graph/search-guest-users';
import { updateGuestCompany } from '@/main/graph/update-guest-company';
import { sessionGetStatusPayloadSchema, sessionStatusSchema } from '@/shared/contracts/session';
import { getExchangeCapabilities } from '@/main/exchange/get-exchange-capabilities';
import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { getGroupMembers } from '@/main/exchange/get-group-members';
import { listExchangeGroups } from '@/main/exchange/list-exchange-groups';
import { recipientDirectory } from '@/main/recipients/recipient-directory';

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
