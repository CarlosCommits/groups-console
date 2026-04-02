import { z } from 'zod';

import { bootstrapCheckStatusSchema } from './session';

export const exchangeGetCapabilitiesPayloadSchema = z.object({}).strict();
export const exchangeConnectPayloadSchema = z
  .object({
    userPrincipalName: z.string().min(3),
  })
  .strict();
export const exchangeGetConnectionStatusPayloadSchema = z.object({}).strict();
export const exchangeDisconnectPayloadSchema = z.object({}).strict();
export const exchangeGroupKindSchema = z.enum([
  'distributionList',
  'mailEnabledSecurityGroup',
]);
export const exchangeListGroupsPayloadSchema = z
  .object({
    kind: z.enum(['all', 'distributionList', 'mailEnabledSecurityGroup']).optional(),
  })
  .strict();
export const exchangeGroupRefSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    groupKind: exchangeGroupKindSchema,
  })
  .strict();
export const groupMemberRecipientTypeSchema = z.enum([
  'mailbox',
  'mailContact',
  'mailUser',
  'distributionList',
  'mailEnabledSecurityGroup',
  'unknown',
]);
export const groupsGetMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
  })
  .strict();

export const exchangeRuntimeSchema = z.object({
  command: z.enum(['powershell.exe', 'pwsh.exe']),
  label: z.enum(['Windows PowerShell', 'PowerShell']),
  version: z.string().min(1),
  edition: z.string().min(1),
});

export const exchangeModuleCapabilitiesSchema = z.object({
  installed: z.boolean(),
  importable: z.boolean(),
  version: z.string().nullable(),
  moduleBase: z.string().nullable(),
  importError: z.string().nullable(),
  commandChecks: z.object({
    connectExchangeOnline: z.boolean(),
    disconnectExchangeOnline: z.boolean(),
    getConnectionInformation: z.boolean(),
  }),
});

export const exchangeCapabilitiesSchema = z.object({
  status: bootstrapCheckStatusSchema,
  detail: z.string().min(1),
  runtime: exchangeRuntimeSchema.nullable(),
  exchangeModule: exchangeModuleCapabilitiesSchema,
});

export const exchangeConnectionStateSchema = z.enum(['connected', 'disconnected', 'error']);

export const exchangeConnectionStatusSchema = z.object({
  state: exchangeConnectionStateSchema,
  detail: z.string().min(1),
  runtime: exchangeRuntimeSchema.nullable(),
  userPrincipalName: z.string().nullable(),
  connectionId: z.string().nullable(),
  tenantId: z.string().nullable(),
  tokenStatus: z.string().nullable(),
  tokenExpiryTimeUtc: z.string().nullable(),
  connectedAtUtc: z.string().nullable(),
});

export const exchangeGroupListItemSchema = z.object({
  objectId: z.string().nullable(),
  exchangeIdentity: z.string().min(1),
  displayName: z.string().min(1),
  alias: z.string().nullable(),
  primaryEmail: z.string().nullable(),
  groupKind: exchangeGroupKindSchema,
  managedByDisplayNames: z.array(z.string()),
  whenChangedUtc: z.string().nullable(),
});

export const exchangeListGroupsResultSchema = z.object({
  appliedKind: z.enum(['all', 'distributionList', 'mailEnabledSecurityGroup']),
  items: z.array(exchangeGroupListItemSchema),
});

export const groupMemberListItemSchema = z.object({
  objectId: z.string().nullable(),
  exchangeIdentity: z.string().min(1),
  displayName: z.string().min(1),
  primaryEmail: z.string().nullable(),
  alias: z.string().nullable(),
  recipientType: groupMemberRecipientTypeSchema,
  recipientTypeDetails: z.string().min(1),
});

export const groupsGetMembersResultSchema = z.object({
  group: exchangeGroupRefSchema,
  items: z.array(groupMemberListItemSchema),
});

export type ExchangeGetCapabilitiesPayload = z.infer<typeof exchangeGetCapabilitiesPayloadSchema>;
export type ExchangeCapabilities = z.infer<typeof exchangeCapabilitiesSchema>;
export type ExchangeConnectPayload = z.infer<typeof exchangeConnectPayloadSchema>;
export type ExchangeConnectionStatus = z.infer<typeof exchangeConnectionStatusSchema>;
export type ExchangeListGroupsPayload = z.infer<typeof exchangeListGroupsPayloadSchema>;
export type ExchangeGroupRef = z.infer<typeof exchangeGroupRefSchema>;
export type ExchangeGroupListItem = z.infer<typeof exchangeGroupListItemSchema>;
export type ExchangeListGroupsResult = z.infer<typeof exchangeListGroupsResultSchema>;
export type GroupsGetMembersPayload = z.infer<typeof groupsGetMembersPayloadSchema>;
export type GroupMemberListItem = z.infer<typeof groupMemberListItemSchema>;
export type GroupsGetMembersResult = z.infer<typeof groupsGetMembersResultSchema>;
