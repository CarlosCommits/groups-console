import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getExchangeConnectionIdentity, getGraphConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type {
  GuestsInvitePayload,
  GuestsInviteResult,
  GuestsUpdateCompanyPayload,
  GuestsUpdateCompanyResult,
} from "@/shared/contracts/guests";

import {
  getInviteGuestMutationOptions,
  getUpdateGuestCompanyMutationOptions,
} from "./use-guest-mutations";

const inviteGuestMock = vi.fn<(payload: GuestsInvitePayload) => Promise<GuestsInviteResult>>();
const updateGuestCompanyMock = vi.fn<
  (payload: GuestsUpdateCompanyPayload) => Promise<GuestsUpdateCompanyResult>
>();

const exchangeConnection: Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
> = {
  state: "connected",
  tenantId: "tenant-a",
  connectionId: "exchange-a",
  userPrincipalName: "admin@example.com",
};

const graphConnection: Pick<
  GraphConnectionStatus,
  "state" | "tenantId" | "configuredTenantId" | "accountUsername"
> = {
  state: "connected",
  tenantId: "tenant-a",
  configuredTenantId: "tenant-a",
  accountUsername: "graph-admin@example.com",
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
}

function seedDirectoryQueries(queryClient: QueryClient) {
  const exchangeIdentity = getExchangeConnectionIdentity(exchangeConnection);
  const graphIdentity = getGraphConnectionIdentity(graphConnection);
  const allIdentity = `${exchangeIdentity}|${graphIdentity}`;

  const exchangeSearchKey = queryKeys.recipientsSearch(exchangeIdentity, "jane", ["mailContact"]);
  const graphSearchKey = queryKeys.recipientsSearch(graphIdentity, "jane", ["guestUser"]);
  const allSearchKey = queryKeys.recipientsSearch(allIdentity, "jane", ["mailContact", "guestUser"]);
  const guestDetailsKey = queryKeys.guestDetails(graphIdentity, "graph:objectId:guest-1");
  const otherGuestDetailsKey = queryKeys.guestDetails(graphIdentity, "graph:objectId:guest-2");

  queryClient.setQueryData(exchangeSearchKey, { items: [{ stableKey: "contact-1" }] });
  queryClient.setQueryData(graphSearchKey, { items: [{ stableKey: "guest-1" }] });
  queryClient.setQueryData(allSearchKey, { items: [{ stableKey: "contact-1" }, { stableKey: "guest-1" }] });
  queryClient.setQueryData(guestDetailsKey, { guest: { stableKey: "graph:objectId:guest-1" } });
  queryClient.setQueryData(otherGuestDetailsKey, { guest: { stableKey: "graph:objectId:guest-2" } });

  return {
    exchangeSearchKey,
    graphSearchKey,
    allSearchKey,
    guestDetailsKey,
    otherGuestDetailsKey,
  };
}

function makeInvitedGuestResult(): GuestsInviteResult {
  return {
    outcome: "invited",
    invitationId: "invite-1",
    invitedUserId: "guest-1",
    invitedUserEmail: "guest@example.com",
    invitedUserDisplayName: "Guest Example",
    invitedUserUserPrincipalName: "guest_example#EXT#@tenant.onmicrosoft.com",
    companyName: "Example Corp",
    inviteRedeemUrl: "https://contoso.example/invite/1",
    status: "PendingAcceptance",
    companyUpdate: {
      attempted: true,
      updated: true,
      detail: "updated",
    },
    verification: {
      attempted: true,
      foundGuest: true,
      detail: "verified",
    },
  };
}

function makeBlockedGuestInviteResult(): GuestsInviteResult {
  return {
    outcome: "blockedConflict",
    conflict: {
      action: "guests.invite",
      category: "emailAlreadyOwned",
      blocking: true,
      targetEmail: "guest@example.com",
      message: "Email already exists.",
      guidance: "Use the existing guest.",
      records: [],
    },
  };
}

function makeUpdateGuestResult(): GuestsUpdateCompanyResult {
  return {
    guestUserId: "guest-1",
    companyName: "Updated Corp",
    verification: {
      attempted: true,
      foundGuest: true,
      companyApplied: true,
      detail: "verified",
    },
  };
}

describe("guest mutation options", () => {
  beforeEach(() => {
    inviteGuestMock.mockReset();
    updateGuestCompanyMock.mockReset();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        radApp: {
          guests: {
            invite: inviteGuestMock,
            updateCompany: updateGuestCompanyMock,
          },
        },
      },
    });
  });

  it("delegates guest invites through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const payload: GuestsInvitePayload = {
      email: "guest@example.com",
      displayName: "Guest Example",
      companyName: "Example Corp",
      sendInvitationMessage: true,
    };
    const result = makeInvitedGuestResult();
    inviteGuestMock.mockResolvedValue(result);

    const options = getInviteGuestMutationOptions(queryClient, exchangeConnection, graphConnection);
    const mutationResult = await options.mutationFn(payload);

    expect(inviteGuestMock).toHaveBeenCalledWith(payload);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates graph and combined recipients-search caches when guest invitation succeeds", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey } = seedDirectoryQueries(queryClient);
    const options = getInviteGuestMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(makeInvitedGuestResult());

    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(false);
  });

  it("does not invalidate search caches for blocked guest invites", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey } = seedDirectoryQueries(queryClient);
    const options = getInviteGuestMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(makeBlockedGuestInviteResult());

    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(false);
  });

  it("delegates guest company updates through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const payload: GuestsUpdateCompanyPayload = {
      guestUserId: "guest-1",
      companyName: "Updated Corp",
    };
    const result = makeUpdateGuestResult();
    updateGuestCompanyMock.mockResolvedValue(result);

    const options = getUpdateGuestCompanyMutationOptions(queryClient, exchangeConnection, graphConnection);
    const mutationResult = await options.mutationFn({
      payload,
      stableKey: "graph:objectId:guest-1",
    });

    expect(updateGuestCompanyMock).toHaveBeenCalledWith(payload);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates graph and combined search caches plus the targeted guest details on update", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey, guestDetailsKey, otherGuestDetailsKey } =
      seedDirectoryQueries(queryClient);
    const options = getUpdateGuestCompanyMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(
      makeUpdateGuestResult(),
      {
        payload: {
          guestUserId: "guest-1",
          companyName: "Updated Corp",
        },
        stableKey: "graph:objectId:guest-1",
      },
    );

    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(guestDetailsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherGuestDetailsKey)?.isInvalidated).toBe(false);
  });
});
