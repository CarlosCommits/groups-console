import type {
  RecipientConflict,
  RecipientConflictAction,
  RecipientConflictRecord,
} from '@/shared/contracts/conflicts';

import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { exchangeSessionManager } from '@/main/exchange/exchange-session-manager';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { graphSessionManager } from '@/main/graph/graph-session-manager';

export async function checkRecipientConflicts<TAction extends RecipientConflictAction>(
  action: TAction,
  targetEmail: string,
): Promise<(RecipientConflict & { action: TAction }) | null> {
  const normalizedEmail = normalizeEmail(targetEmail);
  const [exchangeStatus, graphStatus] = await Promise.all([
    getExchangeConnectionStatus(),
    getGraphConnectionStatus(),
  ]);

  if (action === 'contacts.create') {
    if (exchangeStatus.state !== 'connected') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message:
          'Contact creation is blocked until Exchange Online is connected for overlap validation.',
        guidance:
          'Connect to Exchange Online before creating a contact so the app can verify Exchange recipient ownership for the target email.',
        records: [],
      });
    }

    if (graphStatus.state !== 'connected') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message:
          'Contact creation is blocked until Microsoft Graph is connected for overlap validation.',
        guidance:
          'Connect to Microsoft Graph for the same tenant before creating a contact so the app can rule out an overlapping guest user.',
        records: [],
      });
    }

    if (graphStatus.exchangeAlignment === 'unknown') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message:
          'Contact creation is blocked until the app can verify Microsoft Graph and Exchange tenant alignment.',
        guidance:
          'Reconnect Microsoft Graph and Exchange Online, then retry the contact creation once both sessions report the same tenant.',
        records: [],
      });
    }

    if (graphStatus.exchangeAlignment === 'mismatched') {
      return buildConflict({
        action,
        category: 'tenantMismatch',
        targetEmail: normalizedEmail,
        message:
          'Contact creation is blocked because Microsoft Graph is connected to a different tenant than Exchange.',
        guidance:
          'Reconnect Microsoft Graph so it matches the current Exchange tenant before creating a contact.',
        records: [],
      });
    }
  }

  if (action === 'guests.invite') {
    if (exchangeStatus.state !== 'connected') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message:
          'Guest invitation is blocked until Exchange Online is connected for overlap validation.',
        guidance:
          'Connect to Exchange Online before inviting a guest so the app can check for conflicting Exchange recipients.',
        records: [],
      });
    }

    if (graphStatus.state !== 'connected') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message: 'Guest invitation is blocked until Microsoft Graph is connected.',
        guidance: 'Reconnect Microsoft Graph and try the guest invitation again.',
        records: [],
      });
    }

    if (graphStatus.exchangeAlignment === 'unknown') {
      return buildConflict({
        action,
        category: 'preflightUnavailable',
        targetEmail: normalizedEmail,
        message:
          'Guest invitation is blocked until the app can verify Microsoft Graph and Exchange tenant alignment.',
        guidance:
          'Reconnect Microsoft Graph and Exchange Online, then retry the guest invitation once both sessions report the same tenant.',
        records: [],
      });
    }

    if (graphStatus.exchangeAlignment === 'mismatched') {
      return buildConflict({
        action,
        category: 'tenantMismatch',
        targetEmail: normalizedEmail,
        message:
          'Guest invitation is blocked because Microsoft Graph is connected to a different tenant than Exchange.',
        guidance:
          'Reconnect Microsoft Graph so it matches the current Exchange tenant before inviting a guest.',
        records: [],
      });
    }
  }

  let exchangeRecords: RecipientConflictRecord[] = [];
  let guestRecord: RecipientConflictRecord | null = null;

  try {
    [exchangeRecords, guestRecord] = await Promise.all([
      exchangeSessionManager.lookupRecipientOwnershipByEmail(normalizedEmail),
      graphSessionManager.findGuestByEmail(normalizedEmail),
    ]);
  } catch {
    return buildConflict({
      action,
      category: 'preflightUnavailable',
      targetEmail: normalizedEmail,
      message:
        action === 'contacts.create'
          ? 'Contact creation is blocked because the overlap preflight could not complete.'
          : 'Guest invitation is blocked because the overlap preflight could not complete.',
      guidance:
        action === 'contacts.create'
          ? 'Reconnect Exchange Online and Microsoft Graph, then retry the contact creation once preflight checks are available again.'
          : 'Reconnect Exchange Online and Microsoft Graph, then retry the guest invitation once preflight checks are available again.',
      records: [],
    });
  }

  if (action === 'contacts.create') {
    if (exchangeRecords.length > 0 && guestRecord) {
      return buildConflict({
        action,
        category: 'guestContactOverlap',
        targetEmail: normalizedEmail,
        message:
          'This email already exists in both Exchange and Microsoft Graph, so the app cannot safely create another contact representation.',
        guidance:
          'Review the overlapping Exchange and Graph records and resolve the duplicate identity before creating a contact.',
        records: [...exchangeRecords, guestRecord],
      });
    }

    if (exchangeRecords.length > 0) {
      return buildConflict({
        action,
        category: 'emailAlreadyOwned',
        targetEmail: normalizedEmail,
        message: 'An Exchange recipient already owns this email address.',
        guidance:
          'Use the existing Exchange recipient instead of creating a new contact for the same email address.',
        records: exchangeRecords,
      });
    }

    if (guestRecord) {
      return buildConflict({
        action,
        category: 'guestContactOverlap',
        targetEmail: normalizedEmail,
        message:
          'A Microsoft Graph guest user already exists for this email, so creating a contact would introduce a conflicting dual representation.',
        guidance:
          'Use or update the existing guest record instead of creating a new contact for the same email address.',
        records: [guestRecord],
      });
    }
  }

  if (action === 'guests.invite') {
    const hasOnlyContactOverlap =
      exchangeRecords.length > 0 && exchangeRecords.every((record) => record.recipientType === 'mailContact');

    if (guestRecord) {
      return buildConflict({
        action,
        category: exchangeRecords.length > 0 ? 'guestContactOverlap' : 'emailAlreadyOwned',
        targetEmail: normalizedEmail,
        message:
          exchangeRecords.length > 0
            ? 'A Microsoft Graph guest user already exists for this email address, and Exchange also has a separate recipient with the same email.'
            : 'A Microsoft Graph guest user already exists for this email address.',
        guidance:
          exchangeRecords.length > 0
            ? 'Use the existing guest user instead of sending another invitation. If needed, treat the Exchange recipient and guest as separate principals in later membership workflows.'
            : 'Use the existing guest user instead of sending another invitation for the same email address.',
        records: exchangeRecords.length > 0 ? [...exchangeRecords, guestRecord] : [guestRecord],
      });
    }

    if (exchangeRecords.length > 0 && !hasOnlyContactOverlap) {
      return buildConflict({
        action,
        category: 'emailAlreadyOwned',
        targetEmail: normalizedEmail,
        message: 'An existing Exchange recipient already owns this email address.',
        guidance:
          'Guest invitation is only allowed over an existing contact. Reuse or remediate the existing Exchange recipient before inviting a guest for this email.',
        records: exchangeRecords,
      });
    }
  }

  return null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildConflict<TAction extends RecipientConflictAction>(conflict: {
  action: TAction;
  category: RecipientConflict['category'];
  targetEmail: string;
  message: string;
  guidance: string;
  records: RecipientConflictRecord[];
}): RecipientConflict & { action: TAction } {
  return {
    action: conflict.action,
    category: conflict.category,
    blocking: true,
    targetEmail: conflict.targetEmail,
    message: conflict.message,
    guidance: conflict.guidance,
    records: conflict.records,
  };
}
