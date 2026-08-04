import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('@/main/logging/logger', () => ({
  writeSystemLogEvent: vi.fn(),
}));

vi.mock('@/main/recipients/resolve-recipient-for-membership', () => ({
  resolveRecipientForMembership: vi.fn(),
}));

vi.mock('./get-exchange-connection-status', () => ({
  getExchangeConnectionStatus: vi.fn(),
}));

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    getGroupMemberships: vi.fn(),
    listGroups: vi.fn(),
    getGroupMembers: vi.fn(),
  },
}));

import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';
import { writeSystemLogEvent } from '@/main/logging/logger';
import { runWithOperationContext } from '@/main/logging/operation-context';

import { exchangeSessionManager } from './exchange-session-manager';
import { getExchangeConnectionStatus } from './get-exchange-connection-status';
import { getGroupMemberships } from './get-group-memberships';

describe('getGroupMemberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected to Exchange Online.',
      runtime: null,
      userPrincipalName: 'admin@example.com',
      connectionId: 'connection-1',
      tenantId: 'tenant-1',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
  });

  it('resolves the requested member before delegating to the exchange session manager', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockResolvedValue({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
      items: [
        {
          objectId: 'group-1',
          exchangeIdentity: 'finance-group',
          displayName: 'Finance Distribution',
          alias: 'finance',
          primaryEmail: 'finance@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });

    const result = await getGroupMemberships({
      member: {
        kind: 'exchangeRecipient',
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
      },
    });

    expect(exchangeSessionManager.getGroupMemberships).toHaveBeenCalledWith({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    expect(result.items[0]?.exchangeIdentity).toBe('finance-group');
  });

  it('surfaces deferred guest resolution failures without querying Exchange memberships', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'graphDeferred',
      reason: 'Microsoft Graph must be connected before a guest can be resolved for membership.',
    });

    await expect(
      getGroupMemberships({
        member: {
          kind: 'graphGuest',
          objectId: '00000000-0000-0000-0000-000000000001',
          primaryEmail: 'guest@example.com',
          displayName: 'Guest Example',
        },
      }),
    ).rejects.toThrow(
      'Microsoft Graph must be connected before a guest can be resolved for membership.',
    );

    expect(exchangeSessionManager.getGroupMemberships).not.toHaveBeenCalled();
  });

  it('falls back to listing groups and members when the session host lacks the memberships command', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockRejectedValue(
      new Error("The term 'Invoke-GroupsConsoleGetGroupMemberships' is not recognized as the name of a cmdlet"),
    );
    vi.mocked(exchangeSessionManager.listGroups).mockResolvedValue({
      appliedKind: 'all',
      items: [
        {
          objectId: 'group-1',
          exchangeIdentity: 'finance-group',
          displayName: 'Finance Distribution',
          alias: 'finance',
          primaryEmail: 'finance@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
        {
          objectId: 'group-2',
          exchangeIdentity: 'engineering-group',
          displayName: 'Engineering Distribution',
          alias: 'engineering',
          primaryEmail: 'engineering@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });
    vi.mocked(exchangeSessionManager.getGroupMembers)
      .mockResolvedValueOnce({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: 'group-1',
          groupKind: 'distributionList',
        },
        items: [
          {
            objectId: 'recipient-1',
            exchangeIdentity: 'jane@example.com',
            displayName: 'Jane Example',
            primaryEmail: 'jane@example.com',
            alias: 'jexample',
            recipientType: 'mailbox',
            recipientTypeDetails: 'UserMailbox',
          },
        ],
      })
      .mockResolvedValueOnce({
        group: {
          exchangeIdentity: 'engineering-group',
          objectId: 'group-2',
          groupKind: 'distributionList',
        },
        items: [
          {
            objectId: 'recipient-2',
            exchangeIdentity: 'alex@example.com',
            displayName: 'Alex Example',
            primaryEmail: 'alex@example.com',
            alias: 'aexample',
            recipientType: 'mailbox',
            recipientTypeDetails: 'UserMailbox',
          },
        ],
      });

    const result = await runWithOperationContext(
      {
        operationId: 'operation-1',
        ipcRequestId: 'ipc-request-1',
        commandName: 'groups.getMemberships',
        backendOwner: 'exchange',
      },
      async () =>
        await getGroupMemberships({
          member: {
            kind: 'exchangeRecipient',
            exchangeIdentity: 'jane@example.com',
            objectId: 'recipient-1',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example',
          },
        }),
    );

    expect(exchangeSessionManager.listGroups).toHaveBeenCalledWith({ kind: 'all' });
    expect(exchangeSessionManager.getGroupMembers).toHaveBeenCalledTimes(2);
    expect(result.member.exchangeIdentity).toBe('jane@example.com');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.exchangeIdentity).toBe('finance-group');
    expect(writeSystemLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-1',
        ipcRequestId: 'ipc-request-1',
        actorUpn: 'admin@example.com',
        tenantId: 'tenant-1',
        operationType: 'groups.getMemberships',
        targetObjectType: 'exchangeRecipient',
        targetObjectId: 'jane@example.com',
        result: 'partial',
        authoritative: false,
        summary:
          'Loaded 1 group membership(s) via fallback because Invoke-GroupsConsoleGetGroupMemberships was unavailable.',
      }),
    );
  });

  it('matches fallback memberships by object id when exchange identities differ', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: '/o=ExchangeLabs/ou=Exchange Administrative Group/cn=Recipients/cn=contact-1',
        objectId: 'recipient-1',
        primaryEmail: 'contact@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockRejectedValue(
      new Error("The term 'Invoke-GroupsConsoleGetGroupMemberships' is not recognized as the name of a cmdlet"),
    );
    vi.mocked(exchangeSessionManager.listGroups).mockResolvedValue({
      appliedKind: 'all',
      items: [
        {
          objectId: 'group-1',
          exchangeIdentity: 'example-directory-group',
          displayName: 'Example Directory',
          alias: 'exampledir',
          primaryEmail: 'directory@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });
    vi.mocked(exchangeSessionManager.getGroupMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'example-directory-group',
        objectId: 'group-1',
        groupKind: 'distributionList',
      },
        items: [
          {
            objectId: 'recipient-1',
            exchangeIdentity: 'MailContact_12345',
            displayName: 'Example Contact',
            primaryEmail: 'contact@example.com',
            alias: 'contact.example',
            recipientType: 'mailContact',
            recipientTypeDetails: 'MailContact',
          },
        ],
    });

    const result = await getGroupMemberships({
      member: {
        kind: 'exchangeRecipient',
        exchangeIdentity: '/o=ExchangeLabs/ou=Exchange Administrative Group/cn=Recipients/cn=contact-1',
        objectId: 'recipient-1',
        primaryEmail: 'contact@example.com',
        displayName: 'Example Contact',
      },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.exchangeIdentity).toBe('example-directory-group');
  });

  it('does not cross-match fallback memberships on shared primary email when object ids differ', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'Marla Poor',
        objectId: 'contact-object-id',
        primaryEmail: 'external.contact@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockRejectedValue(
      new Error("The term 'Invoke-GroupsConsoleGetGroupMemberships' is not recognized as the name of a cmdlet"),
    );
    vi.mocked(exchangeSessionManager.listGroups).mockResolvedValue({
      appliedKind: 'all',
      items: [
        {
          objectId: 'group-1',
          exchangeIdentity: 'security-group-1',
          displayName: 'Security Group 1',
          alias: 'security-group-1',
          primaryEmail: 'security-group-1@example.com',
          groupKind: 'mailEnabledSecurityGroup',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });
    vi.mocked(exchangeSessionManager.getGroupMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'security-group-1',
        objectId: 'group-1',
        groupKind: 'mailEnabledSecurityGroup',
      },
      items: [
        {
          objectId: 'guest-object-id',
          exchangeIdentity: 'guest-exchange-identity',
          displayName: 'Marla Poor',
          primaryEmail: 'external.contact@example.com',
          alias: 'marlpo01_noa.nintendo.com#EXT#',
          recipientType: 'guestMailUser',
          recipientTypeDetails: 'GuestMailUser',
        },
      ],
    });

    const result = await getGroupMemberships({
      member: {
        kind: 'exchangeRecipient',
        exchangeIdentity: 'Marla Poor',
        objectId: 'contact-object-id',
        primaryEmail: 'external.contact@example.com',
        displayName: 'Marla Poor',
      },
    });

    expect(result.items).toHaveLength(0);
  });

  it('writes a failed fallback system log when fallback execution also fails', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockRejectedValue(
      new Error("The term 'Invoke-GroupsConsoleGetGroupMemberships' is not recognized as the name of a cmdlet"),
    );
    vi.mocked(exchangeSessionManager.listGroups).mockRejectedValue(
      new Error('Exchange session host is not running. Connect to Exchange Online first.'),
    );

    await expect(
      runWithOperationContext(
        {
          operationId: 'operation-2',
          ipcRequestId: 'ipc-request-2',
          commandName: 'groups.getMemberships',
          backendOwner: 'exchange',
        },
        async () =>
          await getGroupMemberships({
            member: {
              kind: 'exchangeRecipient',
              exchangeIdentity: 'jane@example.com',
              objectId: 'recipient-1',
              primaryEmail: 'jane@example.com',
              displayName: 'Jane Example',
            },
          }),
      ),
    ).rejects.toThrow('Exchange session host is not running. Connect to Exchange Online first.');

    expect(writeSystemLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-2',
        ipcRequestId: 'ipc-request-2',
        operationType: 'groups.getMemberships',
        targetObjectId: 'jane@example.com',
        result: 'failed',
        authoritative: false,
        summary:
          'Fallback was triggered because Invoke-GroupsConsoleGetGroupMemberships was unavailable, but loading group memberships still failed.',
      }),
    );
  });

  it('does not write a fallback system log when the primary memberships command succeeds', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockResolvedValue({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
      items: [],
    });

    await runWithOperationContext(
      {
        operationId: 'operation-3',
        ipcRequestId: 'ipc-request-3',
        commandName: 'groups.getMemberships',
        backendOwner: 'exchange',
      },
      async () =>
        await getGroupMemberships({
          member: {
            kind: 'exchangeRecipient',
            exchangeIdentity: 'jane@example.com',
            objectId: 'recipient-1',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example',
          },
        }),
    );

    expect(writeSystemLogEvent).not.toHaveBeenCalled();
  });

  it('does not fall back when the primary path fails with a bootstrap or parse error', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockRejectedValue(
      new Error('Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118'),
    );

    await expect(
      getGroupMemberships({
        member: {
          kind: 'exchangeRecipient',
          exchangeIdentity: 'jane@example.com',
          objectId: 'recipient-1',
          primaryEmail: 'jane@example.com',
          displayName: 'Jane Example',
        },
      }),
    ).rejects.toThrow('Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118');

    expect(exchangeSessionManager.listGroups).not.toHaveBeenCalled();
    expect(exchangeSessionManager.getGroupMembers).not.toHaveBeenCalled();
  });
});

describe('get-group-memberships PowerShell command', () => {
  it('does not enumerate group members after a zero-result DN membership lookup', () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const commandScript = readFileSync(
      resolve(testDirectory, '../../../powershell/commands/get-group-memberships.ps1'),
      'utf8',
    );

    expect(commandScript).toContain('function ConvertTo-GroupsConsoleOPathStringLiteral');
    expect(commandScript).toContain('Exchange OPATH single-quoted literals escape embedded single quotes');
    expect(commandScript).toContain("-Filter \"Members -eq $distinguishedNameFilterLiteral\"");
    expect(commandScript).toContain('-ErrorAction Stop');
    expect(commandScript).toContain(
      '$memberExchangeIdentity = Get-GroupsConsoleRecipientWriteIdentity -Recipient $resolvedRecipient',
    );
    expect(commandScript).toContain('exchangeIdentity = $memberExchangeIdentity');
    expect(commandScript).not.toContain('exchangeIdentity = [string]$resolvedRecipient.Identity');
    expect(commandScript).not.toMatch(/\bGet-DistributionGroupMember\b/);
  });
});
