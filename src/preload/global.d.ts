import type { ContactsCreatePayload, ContactsCreateResult, ContactsGetDetailsPayload, ContactsGetDetailsResult, ContactsUpdateCompanyPayload, ContactsUpdateCompanyResult } from '@/shared/contracts/contacts';
import type { ExchangeCapabilities } from '@/shared/contracts/exchange';
import type { ExchangeConnectionStatus } from '@/shared/contracts/exchange';
import type { ExchangeGroupRef } from '@/shared/contracts/exchange';
import type { ExchangeListGroupsResult } from '@/shared/contracts/exchange';
import type { ExchangeRecipientGetDetailsPayload, ExchangeRecipientGetDetailsResult } from '@/shared/contracts/exchange';
import type { GroupMemberSelectionRef } from '@/shared/contracts/exchange';
import type { GroupMemberWriteRef } from '@/shared/contracts/exchange';
import type { GroupsAddMembersResult } from '@/shared/contracts/exchange';
import type { GroupsGetMembershipsResult } from '@/shared/contracts/exchange';
import type { GroupsGetMembersResult } from '@/shared/contracts/exchange';
import type { GroupsRemoveMembersResult } from '@/shared/contracts/exchange';
import type { GraphConnectionStatus } from '@/shared/contracts/graph';
import type { GuestsGetDetailsPayload, GuestsGetDetailsResult, GuestsInvitePayload, GuestsInviteResult, GuestsSearchPayload, GuestsSearchResult, GuestsUpdateCompanyPayload, GuestsUpdateCompanyResult } from '@/shared/contracts/guests';
import type { ProgressEvent } from '@/shared/contracts/command';
import type { DiagnosticsExportPayload, DiagnosticsExportResult } from '@/shared/contracts/diagnostics';
import type { RecipientsSearchPayload } from '@/shared/contracts/recipients';
import type { RecipientsSearchResult } from '@/shared/contracts/recipients';
import type { SystemLogsListEventsPayload, SystemLogsListEventsResult } from '@/shared/contracts/system-logs';
import type { ReportsGenerateMembershipMatrixPayload, ReportsGenerateMembershipMatrixResult } from '@/shared/contracts/reports';
import type { SessionStatusSchema } from '@/shared/contracts/session';
import type { UpdateStatus } from '@/shared/contracts/updates';

declare global {
  interface Window {
    groupsConsole: {
      session: {
        getStatus: () => Promise<SessionStatusSchema>;
      };
      updates: {
        getStatus: () => Promise<UpdateStatus>;
        check: () => Promise<UpdateStatus>;
        install: () => Promise<UpdateStatus>;
        onStatusChanged: (listener: (status: UpdateStatus) => void) => () => void;
      };
      exchange: {
        getCapabilities: () => Promise<ExchangeCapabilities>;
        installModule: () => Promise<ExchangeCapabilities>;
        connect: (userPrincipalName: string) => Promise<ExchangeConnectionStatus>;
        getConnectionStatus: () => Promise<ExchangeConnectionStatus>;
        disconnect: () => Promise<ExchangeConnectionStatus>;
        listGroups: (
          kind?: 'all' | 'distributionList' | 'mailEnabledSecurityGroup',
        ) => Promise<ExchangeListGroupsResult>;
        getRecipientDetails: (
          payload: ExchangeRecipientGetDetailsPayload,
        ) => Promise<ExchangeRecipientGetDetailsResult>;
      };
      graph: {
        connect: () => Promise<GraphConnectionStatus>;
        getConnectionStatus: () => Promise<GraphConnectionStatus>;
        disconnect: () => Promise<GraphConnectionStatus>;
      };
      groups: {
        getMembers: (group: ExchangeGroupRef) => Promise<GroupsGetMembersResult>;
        getMemberships: (member: GroupMemberSelectionRef) => Promise<GroupsGetMembershipsResult>;
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
      systemLogs: {
        listEvents: (payload: SystemLogsListEventsPayload) => Promise<SystemLogsListEventsResult>;
      };
      diagnostics: {
        export: (payload?: DiagnosticsExportPayload) => Promise<DiagnosticsExportResult>;
      };
      recipients: {
        search: (payload: RecipientsSearchPayload) => Promise<RecipientsSearchResult>;
      };
    };
  }
}

export {};
