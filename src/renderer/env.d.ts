/// <reference types="vite/client" />

import type { ContactsCreatePayload, ContactsCreateResult, ContactsGetDetailsPayload, ContactsGetDetailsResult, ContactsUpdateCompanyPayload, ContactsUpdateCompanyResult } from '@/shared/contracts/contacts';
import type {
    ExchangeCapabilities,
    ExchangeConnectionStatus,
    ExchangeGroupRef,
    ExchangeListGroupsResult,
    GroupMemberSelectionRef,
    GroupMemberWriteRef,
  GroupsAddMembersResult,
  GroupsGetMembersResult,
  GroupsRemoveMembersResult,
} from '@/shared/contracts/exchange';
import type { GraphConnectionStatus } from '@/shared/contracts/graph';
import type { GuestsGetDetailsPayload, GuestsGetDetailsResult, GuestsInvitePayload, GuestsInviteResult, GuestsSearchPayload, GuestsSearchResult, GuestsUpdateCompanyPayload, GuestsUpdateCompanyResult } from '@/shared/contracts/guests';
import type { ProgressEvent } from '@/shared/contracts/command';
import type { RecipientsSearchPayload, RecipientsSearchResult } from '@/shared/contracts/recipients';
import type { ReportsGenerateMembershipMatrixPayload, ReportsGenerateMembershipMatrixResult } from '@/shared/contracts/reports';
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
          members: GroupMemberSelectionRef[],
        ) => Promise<GroupsAddMembersResult>;
        removeMembers: (
          group: ExchangeGroupRef,
          members: GroupMemberWriteRef[],
        ) => Promise<GroupsRemoveMembersResult>;
      };
      guests: {
        search: (payload: GuestsSearchPayload) => Promise<GuestsSearchResult>;
        getDetails: (payload: GuestsGetDetailsPayload) => Promise<GuestsGetDetailsResult>;
        invite: (payload: GuestsInvitePayload) => Promise<GuestsInviteResult>;
        updateCompany: (payload: GuestsUpdateCompanyPayload) => Promise<GuestsUpdateCompanyResult>;
      };
      contacts: {
        getDetails: (payload: ContactsGetDetailsPayload) => Promise<ContactsGetDetailsResult>;
        create: (payload: ContactsCreatePayload) => Promise<ContactsCreateResult>;
        updateCompany: (payload: ContactsUpdateCompanyPayload) => Promise<ContactsUpdateCompanyResult>;
      };
      reports: {
        generateMembershipMatrix: (
          payload: ReportsGenerateMembershipMatrixPayload,
          onProgress?: (event: ProgressEvent) => void,
        ) => Promise<ReportsGenerateMembershipMatrixResult>;
      };
      recipients: {
        search: (payload: RecipientsSearchPayload) => Promise<RecipientsSearchResult>;
      };
    };
  }
}

export {};
