import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/powershell/start-exchange-session-host', () => ({
  startExchangeSessionHost: vi.fn(),
}));

import { startExchangeSessionHost } from '@/main/powershell/start-exchange-session-host';

import { ExchangeSessionManager } from './exchange-session-manager';

describe('ExchangeSessionManager', () => {
  it('returns disconnected status when the host is not running', async () => {
    const manager = new ExchangeSessionManager();

    const result = await manager.getConnectionStatus();

    expect(result.state).toBe('disconnected');
  });

  it('starts a host and returns parsed connection state on connect', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi.fn().mockResolvedValue({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    const result = await manager.connect({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('connected');
    expect(result.runtime?.command).toBe('powershell.exe');
  });

  it('disconnects idempotently when no host exists', async () => {
    const manager = new ExchangeSessionManager();

    const result = await manager.disconnect();

    expect(result.state).toBe('disconnected');
  });

  it('lists groups through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          appliedKind: 'mailEnabledSecurityGroup',
          items: [
            {
              objectId: null,
              exchangeIdentity: 'group-identity-2',
              displayName: 'IT Security',
              alias: 'itsecurity',
              primaryEmail: 'itsecurity@example.com',
              groupKind: 'mailEnabledSecurityGroup',
              managedByDisplayNames: ['Owner One'],
              whenChangedUtc: '2026-04-01T12:00:00.000Z',
            },
          ],
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.listGroups({ kind: 'mailEnabledSecurityGroup' });

    expect(result.appliedKind).toBe('mailEnabledSecurityGroup');
    expect(result.items[0]?.groupKind).toBe('mailEnabledSecurityGroup');
  });

  it('creates contacts through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          outcome: 'created',
          contact: {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example',
            companyName: 'Example Corp',
          },
          verification: {
            attempted: true,
            companyApplied: true,
            detail: 'Verified contact creation and company assignment.',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.createContact({
      firstName: 'Jane',
      lastName: 'Example',
      email: 'jane@example.com',
      companyName: 'Example Corp',
    });

    expect(result.outcome).toBe('created');
    if (result.outcome !== 'created') {
      throw new Error('Expected Exchange session manager to return a created contact result.');
    }

    expect(result.contact.companyName).toBe('Example Corp');
  });

  it('updates contact company through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          contact: {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
            companyName: 'New Company',
          },
          verification: {
            attempted: true,
            companyApplied: true,
            detail: 'Verified company update.',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.updateContactCompany({
      exchangeIdentity: 'jane@example.com',
      companyName: 'New Company',
    });

    expect(result.contact.companyName).toBe('New Company');
  });

  it('reads contact details through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          contact: {
            exchangeIdentity: 'jane@example.com',
            objectId: 'contact-1',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example',
            alias: 'jexample',
            companyName: 'Example Corp',
            firstName: 'Jane',
            lastName: 'Example',
            title: 'Director',
            department: 'Operations',
            phone: '+1 555-0100',
            office: 'HQ-201',
            streetAddress: '1 Example Way',
            city: 'New York',
            stateOrProvince: 'NY',
            postalCode: '10001',
            countryOrRegion: 'US',
            recipientTypeDetails: 'MailContact',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.getContactDetails('jane@example.com');

    expect(result.contact.alias).toBe('jexample');
  });

  it('reads mailbox and mail user details through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          recipient: {
            exchangeIdentity: 'jane@example.com',
            objectId: 'recipient-1',
            primaryEmail: 'jane@example.com',
            externalEmailAddress: null,
            displayName: 'Jane Example',
            alias: 'jexample',
            companyName: 'Example Corp',
            firstName: 'Jane',
            lastName: 'Example',
            title: 'Director',
            department: 'Operations',
            phone: '+1 555-0100',
            office: 'HQ-201',
            userPrincipalName: 'jane@example.com',
            recipientType: 'mailbox',
            recipientTypeDetails: 'UserMailbox',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.getRecipientDetails('jane@example.com');

    expect(result.recipient.recipientType).toBe('mailbox');
    expect(result.recipient.userPrincipalName).toBe('jane@example.com');
    expect(result.recipient.externalEmailAddress).toBeNull();
  });

  it('preserves distinct primary and external email addresses for mail users', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          recipient: {
            exchangeIdentity: 'jane.external@example.com',
            objectId: 'recipient-2',
            primaryEmail: 'jane@yourcompany.com',
            externalEmailAddress: 'jane@gmail.com',
            displayName: 'Jane External',
            alias: 'jexternal',
            companyName: 'Example Corp',
            firstName: 'Jane',
            lastName: 'External',
            title: 'Director',
            department: 'Operations',
            phone: '+1 555-0100',
            office: 'HQ-201',
            userPrincipalName: 'jane_external#EXT#@tenant.onmicrosoft.com',
            recipientType: 'mailUser',
            recipientTypeDetails: 'MailUser',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.getRecipientDetails('jane.external@example.com');

    expect(result.recipient.recipientType).toBe('mailUser');
    expect(result.recipient.primaryEmail).toBe('jane@yourcompany.com');
    expect(result.recipient.externalEmailAddress).toBe('jane@gmail.com');
  });

  it('searches recipients through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          query: 'ja',
          appliedLimit: 25,
          appliedTypes: ['mailbox'],
          sourceStatus: {
            exchange: 'searched',
            graph: 'deferred',
          },
          items: [
            {
              source: 'exchange',
              stableKey: 'exchange:objectId:recipient-1',
              recipientType: 'mailbox',
              membershipSupport: 'exchangeDirect',
              objectId: 'recipient-1',
              exchangeIdentity: 'jane@example.com',
              primaryEmail: 'jane@example.com',
              displayName: 'Jane Example',
              alias: 'jexample',
              recipientTypeDetails: 'UserMailbox',
              companyName: 'Example Corp',
              companySource: 'exchange',
            },
          ],
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox'],
    });

    expect(result.items[0]?.exchangeIdentity).toBe('jane@example.com');
  });

  it('reads group members through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          group: {
            exchangeIdentity: 'finance-group',
            objectId: null,
            groupKind: 'distributionList',
          },
          items: [
            {
              objectId: 'recipient-1',
              exchangeIdentity: 'recipient-identity-1',
              displayName: 'Jane Example',
              primaryEmail: 'jane@example.com',
              alias: 'jexample',
              recipientType: 'mailbox',
              recipientTypeDetails: 'UserMailbox',
            },
          ],
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.getGroupMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
    });

    expect(result.items[0]?.primaryEmail).toBe('jane@example.com');
  });

  it('does not clear the host on ordinary member-read failures', async () => {
    const manager = new ExchangeSessionManager();
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('Member read failed.'))
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      });

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: requestMock,
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    await expect(
      manager.getGroupMembers({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
      }),
    ).rejects.toThrow('Member read failed.');

    const status = await manager.getConnectionStatus();
    expect(status.state).toBe('connected');
  });

  it('adds members through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          group: {
            exchangeIdentity: 'finance-group',
            objectId: null,
            groupKind: 'distributionList',
          },
          summary: {
            requested: 1,
            added: 1,
            alreadyMember: 0,
            invalid: 0,
            verificationFailed: 0,
            failed: 0,
          },
          items: [
            {
              member: {
                exchangeIdentity: 'jane@example.com',
                objectId: null,
                primaryEmail: 'jane@example.com',
              },
              status: 'added',
              detail: 'Added successfully.',
            },
          ],
          verification: {
            attempted: true,
            verifiedAdded: 1,
            detail: 'Verified 1 added member.',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.addMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: null,
          primaryEmail: 'jane@example.com',
        },
      ],
      verify: true,
    });

    expect(result.summary.added).toBe(1);
  });

  it('removes members through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          group: {
            exchangeIdentity: 'finance-group',
            objectId: null,
            groupKind: 'distributionList',
          },
          summary: {
            requested: 1,
            removed: 1,
            notMember: 0,
            invalid: 0,
            verificationFailed: 0,
            failed: 0,
          },
          items: [
            {
              member: {
                exchangeIdentity: 'jane@example.com',
                objectId: null,
                primaryEmail: 'jane@example.com',
              },
              status: 'removed',
              detail: 'Removed successfully.',
            },
          ],
          verification: {
            attempted: true,
            verifiedRemoved: 1,
            detail: 'Verified removed members.',
          },
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.removeMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: null,
          primaryEmail: 'jane@example.com',
        },
      ],
      verify: true,
    });

    expect(result.summary.removed).toBe(1);
  });

  it('does not clear the host on ordinary list command failures', async () => {
    const manager = new ExchangeSessionManager();
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('List failed.'))
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      });

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: requestMock,
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    await expect(manager.listGroups({ kind: 'all' })).rejects.toThrow('List failed.');

    const status = await manager.getConnectionStatus();
    expect(status.state).toBe('connected');
  });

  it('returns an error state when the host cannot be started', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockRejectedValue(new Error('Host startup failed.'));

    const result = await manager.connect({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('error');
    expect(result.detail).toContain('Host startup failed.');
  });

  it('resolves guest mail users through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          resolved: true,
          member: {
            exchangeIdentity: 'Guest_abc123',
            objectId: 'guest-1',
            primaryEmail: 'guest@example.com',
          },
          detail: 'Resolved the selected guest to an Exchange GuestMailUser.',
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.resolveGuestMailUserByObjectId('guest-1', 'guest@example.com');

    expect(result.resolved).toBe(true);
    expect(result.member?.exchangeIdentity).toBe('Guest_abc123');
  });

  it('streams report export data through the live host', async () => {
    const manager = new ExchangeSessionManager();
    const onProgress = vi.fn();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockImplementationOnce((_command, _payload, progress) => {
          progress?.({
            requestId: 'req-1',
            phase: 'executing',
            message: 'Reading members.',
            percent: 55,
          });

          return {
            appliedKind: 'all',
            generatedAt: '2026-04-14T12:00:00.000Z',
            groups: [],
            rows: [],
            summary: {
              groupCount: 0,
              recipientCount: 0,
              membershipCount: 0,
            },
          };
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.exportReportData({ kind: 'all' }, onProgress);

    expect(result.summary.groupCount).toBe(0);
    expect(onProgress).toHaveBeenCalledWith({
      requestId: 'req-1',
      phase: 'executing',
      message: 'Reading members.',
      percent: 55,
    });
  });
});
