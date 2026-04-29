import { z } from 'zod';

import { bootstrapCheckStatusSchema } from './session';

export const exchangeGetCapabilitiesPayloadSchema = z.object({}).strict();
export const exchangeInstallModulePayloadSchema = z.object({}).strict();
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
export const exchangeRecipientDetailTypeSchema = z.enum(['mailbox', 'mailUser']);
export const exchangeRecipientGetDetailsPayloadSchema = z
  .object({
    stableKey: z.string().min(1),
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
  'guestMailUser',
  'distributionList',
  'mailEnabledSecurityGroup',
  'unknown',
]);
export const groupsGetMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
  })
  .strict();
export const groupsExportMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
    groupDisplayName: z.string().min(1),
    groupPrimaryEmail: z.string().nullable(),
  })
  .strict();
export const groupMemberWriteRefSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    primaryEmail: z.string().nullable(),
  })
  .strict();
export const exchangeMemberSelectionRefSchema = z
  .object({
    kind: z.literal('exchangeRecipient'),
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    primaryEmail: z.string().nullable(),
    displayName: z.string().min(1),
  })
  .strict();
export const graphGuestMemberSelectionRefSchema = z
  .object({
    kind: z.literal('graphGuest'),
    objectId: z.string().uuid(),
    primaryEmail: z.string().nullable(),
    displayName: z.string().min(1),
  })
  .strict();
export const groupMemberSelectionRefSchema = z.discriminatedUnion('kind', [
  exchangeMemberSelectionRefSchema,
  graphGuestMemberSelectionRefSchema,
]);
export const guestMembershipTargetResultSchema = z
  .object({
    resolved: z.boolean(),
    member: groupMemberWriteRefSchema.nullable(),
    detail: z.string().min(1),
  })
  .strict();
export const groupsGetMembershipsPayloadSchema = z
  .object({
    member: groupMemberSelectionRefSchema,
  })
  .strict();
export const resolvedGroupsGetMembershipsPayloadSchema = z
  .object({
    member: groupMemberWriteRefSchema,
  })
  .strict();
export const groupsAddMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
    members: z.array(groupMemberSelectionRefSchema).min(1),
    verify: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.members.forEach((member, index) => {
      const key =
        member.kind === 'exchangeRecipient'
          ? `exchange:${member.exchangeIdentity.toLowerCase()}`
          : `graph:${member.objectId.toLowerCase()}`;

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index],
          message: 'Duplicate member selections are not allowed.',
        });
        return;
      }

      seen.add(key);
    });
  });
export const resolvedGroupsAddMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
    members: z.array(groupMemberWriteRefSchema).min(1),
    verify: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.members.forEach((member, index) => {
      const key = member.exchangeIdentity.toLowerCase();

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index, 'exchangeIdentity'],
          message: 'Duplicate member exchangeIdentity values are not allowed.',
        });
        return;
      }

      seen.add(key);
    });
  });
export const groupsRemoveMembersPayloadSchema = z
  .object({
    group: exchangeGroupRefSchema,
    members: z.array(groupMemberWriteRefSchema).min(1),
    verify: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.members.forEach((member, index) => {
      const key = member.exchangeIdentity.toLowerCase();

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index, 'exchangeIdentity'],
          message: 'Duplicate member exchangeIdentity values are not allowed.',
        });
        return;
      }

      seen.add(key);
    });
  });

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

export const groupsGetMembershipsResultSchema = z.object({
  member: groupMemberWriteRefSchema,
  items: z.array(exchangeGroupListItemSchema),
});

export const exchangeRecipientDetailsSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    primaryEmail: z.string().nullable(),
    externalEmailAddress: z.string().nullable(),
    displayName: z.string().min(1),
    alias: z.string().nullable(),
    companyName: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    title: z.string().nullable(),
    department: z.string().nullable(),
    phone: z.string().nullable(),
    office: z.string().nullable(),
    userPrincipalName: z.string().nullable(),
    recipientType: exchangeRecipientDetailTypeSchema,
    recipientTypeDetails: z.string().min(1),
  })
  .strict();

export const exchangeRecipientGetDetailsResultSchema = z.object({
  recipient: exchangeRecipientDetailsSchema,
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

export const groupsExportMembersResultSchema = z.object({
  group: exchangeGroupRefSchema,
  outputPath: z.string().min(1),
  generatedAt: z.string().datetime(),
  summary: z.object({
    memberCount: z.number().int().nonnegative(),
  }),
});

export const groupsAddMembersResultItemSchema = z.object({
  member: groupMemberWriteRefSchema,
  status: z.enum(['added', 'alreadyMember', 'invalid', 'verificationFailed', 'failed']),
  detail: z.string().min(1),
});

export const groupsAddMembersResultSchema = z.object({
  group: exchangeGroupRefSchema,
  summary: z.object({
    requested: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    alreadyMember: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
    verificationFailed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  items: z.array(groupsAddMembersResultItemSchema),
  verification: z.object({
    attempted: z.literal(true),
    verifiedAdded: z.number().int().nonnegative(),
    detail: z.string().min(1),
  }),
});

export const groupsRemoveMembersResultItemSchema = z.object({
  member: groupMemberWriteRefSchema,
  status: z.enum(['removed', 'notMember', 'invalid', 'verificationFailed', 'failed']),
  detail: z.string().min(1),
});

export const groupsRemoveMembersResultSchema = z.object({
  group: exchangeGroupRefSchema,
  summary: z.object({
    requested: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    notMember: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
    verificationFailed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  items: z.array(groupsRemoveMembersResultItemSchema),
  verification: z.object({
    attempted: z.literal(true),
    verifiedRemoved: z.number().int().nonnegative(),
    detail: z.string().min(1),
  }),
});

export type ExchangeGetCapabilitiesPayload = z.infer<typeof exchangeGetCapabilitiesPayloadSchema>;
export type ExchangeInstallModulePayload = z.infer<typeof exchangeInstallModulePayloadSchema>;
export type ExchangeCapabilities = z.infer<typeof exchangeCapabilitiesSchema>;
export type ExchangeConnectPayload = z.infer<typeof exchangeConnectPayloadSchema>;
export type ExchangeConnectionState = z.infer<typeof exchangeConnectionStateSchema>;
export type ExchangeConnectionStatus = z.infer<typeof exchangeConnectionStatusSchema>;
export type ExchangeListGroupsPayload = z.infer<typeof exchangeListGroupsPayloadSchema>;
export type ExchangeRecipientDetailType = z.infer<typeof exchangeRecipientDetailTypeSchema>;
export type ExchangeRecipientGetDetailsPayload = z.infer<typeof exchangeRecipientGetDetailsPayloadSchema>;
export type ExchangeGroupRef = z.infer<typeof exchangeGroupRefSchema>;
export type ExchangeGroupListItem = z.infer<typeof exchangeGroupListItemSchema>;
export type ExchangeListGroupsResult = z.infer<typeof exchangeListGroupsResultSchema>;
export type ExchangeRecipientDetails = z.infer<typeof exchangeRecipientDetailsSchema>;
export type ExchangeRecipientGetDetailsResult = z.infer<typeof exchangeRecipientGetDetailsResultSchema>;
export type GroupsGetMembersPayload = z.infer<typeof groupsGetMembersPayloadSchema>;
export type GroupsExportMembersPayload = z.infer<typeof groupsExportMembersPayloadSchema>;
export type GroupMemberListItem = z.infer<typeof groupMemberListItemSchema>;
export type GroupsGetMembersResult = z.infer<typeof groupsGetMembersResultSchema>;
export type GroupsExportMembersResult = z.infer<typeof groupsExportMembersResultSchema>;
export type GroupMemberWriteRef = z.infer<typeof groupMemberWriteRefSchema>;
export type ExchangeMemberSelectionRef = z.infer<typeof exchangeMemberSelectionRefSchema>;
export type GraphGuestMemberSelectionRef = z.infer<typeof graphGuestMemberSelectionRefSchema>;
export type GroupMemberSelectionRef = z.infer<typeof groupMemberSelectionRefSchema>;
export type GuestMembershipTargetResult = z.infer<typeof guestMembershipTargetResultSchema>;
export type GroupsGetMembershipsPayload = z.infer<typeof groupsGetMembershipsPayloadSchema>;
export type ResolvedGroupsGetMembershipsPayload = z.infer<
  typeof resolvedGroupsGetMembershipsPayloadSchema
>;
export type GroupsGetMembershipsResult = z.infer<typeof groupsGetMembershipsResultSchema>;
export type GroupsAddMembersPayload = z.infer<typeof groupsAddMembersPayloadSchema>;
export type ResolvedGroupsAddMembersPayload = z.infer<typeof resolvedGroupsAddMembersPayloadSchema>;
export type GroupsAddMembersResult = z.infer<typeof groupsAddMembersResultSchema>;
export type GroupsRemoveMembersPayload = z.infer<typeof groupsRemoveMembersPayloadSchema>;
export type GroupsRemoveMembersResult = z.infer<typeof groupsRemoveMembersResultSchema>;
