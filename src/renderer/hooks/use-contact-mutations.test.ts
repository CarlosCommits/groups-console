import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getExchangeConnectionIdentity, getGraphConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type {
  ContactsCreatePayload,
  ContactsCreateResult,
  ContactsUpdateCompanyPayload,
  ContactsUpdateCompanyResult,
} from "@/shared/contracts/contacts";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

import {
  getCreateContactMutationOptions,
  getUpdateContactCompanyMutationOptions,
} from "./use-contact-mutations";

const createContactMock = vi.fn<(payload: ContactsCreatePayload) => Promise<ContactsCreateResult>>();
const updateContactCompanyMock = vi.fn<
  (payload: ContactsUpdateCompanyPayload) => Promise<ContactsUpdateCompanyResult>
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
  const contactDetailsKey = queryKeys.contactDetails(exchangeIdentity, "exchange:objectId:mailContact:1");
  const otherContactDetailsKey = queryKeys.contactDetails(exchangeIdentity, "exchange:objectId:mailContact:2");

  queryClient.setQueryData(exchangeSearchKey, { items: [{ stableKey: "contact-1" }] });
  queryClient.setQueryData(graphSearchKey, { items: [{ stableKey: "guest-1" }] });
  queryClient.setQueryData(allSearchKey, { items: [{ stableKey: "contact-1" }, { stableKey: "guest-1" }] });
  queryClient.setQueryData(contactDetailsKey, { contact: { stableKey: "exchange:objectId:mailContact:1" } });
  queryClient.setQueryData(otherContactDetailsKey, { contact: { stableKey: "exchange:objectId:mailContact:2" } });

  return {
    exchangeSearchKey,
    graphSearchKey,
    allSearchKey,
    contactDetailsKey,
    otherContactDetailsKey,
  };
}

function makeCreatedContactResult(): ContactsCreateResult {
  return {
    outcome: "created",
    contact: {
      exchangeIdentity: "contact-1@example.com",
      objectId: "contact-1",
      primaryEmail: "contact-1@example.com",
      displayName: "Contact One",
      companyName: "Example Corp",
    },
    verification: {
      attempted: true,
      companyApplied: true,
      detail: "verified",
    },
  };
}

function makeBlockedContactCreateResult(): ContactsCreateResult {
  return {
    outcome: "blockedConflict",
    conflict: {
      action: "contacts.create",
      category: "emailAlreadyOwned",
      blocking: true,
      targetEmail: "contact-1@example.com",
      message: "Email already exists.",
      guidance: "Use the existing contact.",
      records: [],
    },
  };
}

function makeUpdateContactResult(): ContactsUpdateCompanyResult {
  return {
    contact: {
      exchangeIdentity: "contact-1@example.com",
      objectId: "contact-1",
      primaryEmail: "contact-1@example.com",
      companyName: "Updated Corp",
    },
    verification: {
      attempted: true,
      companyApplied: true,
      detail: "verified",
    },
  };
}

describe("contact mutation options", () => {
  beforeEach(() => {
    createContactMock.mockReset();
    updateContactCompanyMock.mockReset();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        radApp: {
          contacts: {
            create: createContactMock,
            updateCompany: updateContactCompanyMock,
          },
        },
      },
    });
  });

  it("delegates contact creation through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const payload: ContactsCreatePayload = {
      displayName: "Jane Example",
      alias: "jexample",
      firstName: "Jane",
      lastName: "Example",
      email: "jane@example.com",
      companyName: "Example Corp",
    };
    const result = makeCreatedContactResult();
    createContactMock.mockResolvedValue(result);

    const options = getCreateContactMutationOptions(queryClient, exchangeConnection, graphConnection);
    const mutationResult = await options.mutationFn(payload);

    expect(createContactMock).toHaveBeenCalledWith(payload);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates exchange and combined recipients-search caches when contact creation succeeds", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey } = seedDirectoryQueries(queryClient);
    const options = getCreateContactMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(makeCreatedContactResult());

    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(false);
  });

  it("does not invalidate search caches for blocked contact creation", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey } = seedDirectoryQueries(queryClient);
    const options = getCreateContactMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(makeBlockedContactCreateResult());

    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(false);
  });

  it("delegates contact company updates through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const payload: ContactsUpdateCompanyPayload = {
      exchangeIdentity: "contact-1@example.com",
      companyName: "Updated Corp",
    };
    const result = makeUpdateContactResult();
    updateContactCompanyMock.mockResolvedValue(result);

    const options = getUpdateContactCompanyMutationOptions(queryClient, exchangeConnection, graphConnection);
    const mutationResult = await options.mutationFn({
      payload,
      stableKey: "exchange:objectId:mailContact:1",
    });

    expect(updateContactCompanyMock).toHaveBeenCalledWith(payload);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates exchange and combined search caches plus the targeted contact details on update", async () => {
    const queryClient = createQueryClient();
    const { exchangeSearchKey, graphSearchKey, allSearchKey, contactDetailsKey, otherContactDetailsKey } =
      seedDirectoryQueries(queryClient);
    const options = getUpdateContactCompanyMutationOptions(queryClient, exchangeConnection, graphConnection);

    await options.onSuccess?.(
      makeUpdateContactResult(),
      {
        payload: {
          exchangeIdentity: "contact-1@example.com",
          companyName: "Updated Corp",
        },
        stableKey: "exchange:objectId:mailContact:1",
      },
    );

    expect(queryClient.getQueryState(exchangeSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allSearchKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(graphSearchKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(contactDetailsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherContactDetailsKey)?.isInvalidated).toBe(false);
  });
});
