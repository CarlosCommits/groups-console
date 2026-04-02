import type { ContactsCreatePayload, ContactsCreateResult, ContactsUpdateCompanyPayload, ContactsUpdateCompanyResult } from '@/shared/contracts/contacts';
import type { ExchangeCapabilities } from '@/shared/contracts/exchange';
import type { ExchangeConnectionStatus } from '@/shared/contracts/exchange';
import type { ExchangeGroupRef } from '@/shared/contracts/exchange';
import type { ExchangeListGroupsResult } from '@/shared/contracts/exchange';
import type { GroupMemberWriteRef } from '@/shared/contracts/exchange';
import type { GroupsAddMembersResult } from '@/shared/contracts/exchange';
import type { GroupsGetMembersResult } from '@/shared/contracts/exchange';
import type { GroupsRemoveMembersResult } from '@/shared/contracts/exchange';
import type { GraphConnectionStatus } from '@/shared/contracts/graph';
import type { GuestsInvitePayload, GuestsInviteResult, GuestsSearchPayload, GuestsSearchResult, GuestsUpdateCompanyPayload, GuestsUpdateCompanyResult } from '@/shared/contracts/guests';
import type { RecipientsSearchPayload } from '@/shared/contracts/recipients';
import type { RecipientsSearchResult } from '@/shared/contracts/recipients';
import type { SessionStatusSchema } from '@/shared/contracts/session';

declare global {
  interface Window {
    radApp: {
      session: {
        getStatus: () => Promise<SessionStatusSchema>;
      };
      exchange: {
        getCapabilities: () => Promise<ExchangeCapabilities>;
        connect: (userPrincipalName: string) => Promise<ExchangeConnectionStatus>;
        getConnectionStatus: () => Promise<ExchangeConnectionStatus>;
        disconnect: () => Promise<ExchangeConnectionStatus>;
        listGroups: (
          kind?: 'all' | 'distributionList' | 'mailEnabledSecurityGroup',
        ) => Promise<ExchangeListGroupsResult>;
      };
      graph: {
        connect: () => Promise<GraphConnectionStatus>;
        getConnectionStatus: () => Promise<GraphConnectionStatus>;
        disconnect: () => Promise<GraphConnectionStatus>;
      };
      groups: {
        getMembers: (group: ExchangeGroupRef) => Promise<GroupsGetMembersResult>;
        addMembers: (
          group: ExchangeGroupRef,
          members: GroupMemberWriteRef[],
        ) => Promise<GroupsAddMembersResult>;
        removeMembers: (
          group: ExchangeGroupRef,
          members: GroupMemberWriteRef[],
        ) => Promise<GroupsRemoveMembersResult>;
      };
      guests: {
        search: (payload: GuestsSearchPayload) => Promise<GuestsSearchResult>;
        invite: (payload: GuestsInvitePayload) => Promise<GuestsInviteResult>;
        updateCompany: (payload: GuestsUpdateCompanyPayload) => Promise<GuestsUpdateCompanyResult>;
      };
      contacts: {
        create: (payload: ContactsCreatePayload) => Promise<ContactsCreateResult>;
        updateCompany: (payload: ContactsUpdateCompanyPayload) => Promise<ContactsUpdateCompanyResult>;
      };
      recipients: {
        search: (payload: RecipientsSearchPayload) => Promise<RecipientsSearchResult>;
      };
    };
  }
}

export {};
