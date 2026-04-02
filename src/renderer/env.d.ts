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
    };
  }
}

export {};
