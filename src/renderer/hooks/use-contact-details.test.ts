import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactsGetDetailsResult } from "@/shared/contracts/contacts";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof ReactQuery>(
    "@tanstack/react-query",
  );

  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

import {
  getContactDetailsQueryOptions,
  invalidateContactDetailsQuery,
  removeContactDetailsQuery,
  useContactDetailsQuery,
} from "./use-contact-details";

function makeContactDetailsResult(): ContactsGetDetailsResult {
  return {
    contact: {
      exchangeIdentity: "contact-1@example.com",
      objectId: "obj-1",
      primaryEmail: "contact-1@example.com",
      displayName: "Test Contact",
      alias: "test-contact",
      companyName: "Example Corp",
      firstName: "Test",
      lastName: "Contact",
      title: "Director",
      department: "Operations",
      phone: "+1 555-0100",
      office: "HQ-201",
      streetAddress: null,
      city: null,
      stateOrProvince: null,
      postalCode: null,
      countryOrRegion: null,
      recipientTypeDetails: "MailContact",
    },
  };
}

function makeCommandFailure() {
  const err = new Error("Contact details bridge timed out") as Error & {
    code: string;
    retryable: boolean;
    details: string;
    classification: {
      category: string;
      remediation: string;
      backend: string;
      operation: string;
      guidance: string;
    };
  };

  err.name = "CommandFailure";
  err.code = "contacts_timeout";
  err.retryable = true;
  err.details = "Contact details request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "contacts.getDetails",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useContactDetailsQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("configures the shared query as disabled when Exchange is disconnected", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useContactDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      "exchange:objectId:mailContact:1",
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getContactDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.contact).toBeNull();
    expect(result.error).toBeNull();
  });

  it("configures the shared query as disabled when no stable key is provided", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useContactDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      undefined,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getContactDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("does not allow an explicit enabled flag to bypass a disconnected Exchange session", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useContactDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      "exchange:objectId:mailContact:1",
      true,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getContactDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeContactDetailsResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useContactDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailContact:1",
    );

    expect(result.contact).toEqual(data.contact);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(true);
    expect(result.error).toBeNull();
    expect(result.errorPresentation).toBeNull();
  });

  it("formats query failures with the shared command failure presenter", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: makeCommandFailure(),
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useContactDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailContact:1",
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Contact details request timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Contact details request timed out. Reconnect to Exchange Online.");
  });
});

describe("getContactDetailsQueryOptions", () => {
  const getDetailsMock = vi.fn<() => Promise<ContactsGetDetailsResult>>();

  beforeEach(() => {
    getDetailsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        radApp: {
          contacts: {
            getDetails: getDetailsMock,
          },
        },
      },
    });
  });

  it("reuses the cached contact details for the same connection and stable key", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeContactDetailsResult();
    getDetailsMock.mockResolvedValue(result);

    const options = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:1",
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(getDetailsMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached contact details by connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAResult = makeContactDetailsResult();
    const tenantBResult = makeContactDetailsResult();

    getDetailsMock
      .mockResolvedValueOnce(tenantAResult)
      .mockResolvedValueOnce(tenantBResult);

    const tenantAOptions = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:1",
      true,
    );
    const tenantBOptions = getContactDetailsQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      "exchange:objectId:mailContact:1",
      true,
    );

    await queryClient.fetchQuery(tenantAOptions);
    await queryClient.fetchQuery(tenantBOptions);

    expect(getDetailsMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(tenantAOptions.queryKey)).toEqual(tenantAResult);
    expect(queryClient.getQueryData(tenantBOptions.queryKey)).toEqual(tenantBResult);
  });

  it("invalidates only the current contact details scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const contactAOptions = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:1",
      true,
    );
    const contactBOptions = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:2",
      true,
    );

    queryClient.setQueryData(contactAOptions.queryKey, makeContactDetailsResult());
    queryClient.setQueryData(contactBOptions.queryKey, makeContactDetailsResult());

    await invalidateContactDetailsQuery(
      queryClient,
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailContact:1",
    );

    expect(queryClient.getQueryState(contactAOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(contactBOptions.queryKey)?.isInvalidated).toBe(false);
  });

  it("removes only the targeted contact details query from cache", () => {
    const queryClient = new QueryClient();

    const contactAOptions = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:1",
      true,
    );
    const contactBOptions = getContactDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailContact:2",
      true,
    );

    queryClient.setQueryData(contactAOptions.queryKey, makeContactDetailsResult());
    queryClient.setQueryData(contactBOptions.queryKey, makeContactDetailsResult());

    removeContactDetailsQuery(queryClient, {
      state: "connected",
      tenantId: "tenant-a",
      connectionId: "exchange-a",
      userPrincipalName: "admin@example.com",
    }, "exchange:objectId:mailContact:1");

    expect(queryClient.getQueryData(contactAOptions.queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(contactBOptions.queryKey)).toEqual(makeContactDetailsResult());
  });
});
