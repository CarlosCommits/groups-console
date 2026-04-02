/// <reference types="vite/client" />

import type {
  ExchangeCapabilities,
  ExchangeConnectionStatus,
  ExchangeGroupRef,
  ExchangeListGroupsResult,
  GroupMemberWriteRef,
  GroupsAddMembersResult,
  GroupsGetMembersResult,
  GroupsRemoveMembersResult,
} from '@/shared/contracts/exchange';
import type { GraphConnectionStatus } from '@/shared/contracts/graph';
import type { GuestsInvitePayload, GuestsInviteResult, GuestsSearchPayload, GuestsSearchResult } from '@/shared/contracts/guests';
import type { RecipientsSearchPayload, RecipientsSearchResult } from '@/shared/contracts/recipients';
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
      };
      recipients: {
        search: (payload: RecipientsSearchPayload) => Promise<RecipientsSearchResult>;
      };
    };
  }
}

export {};
