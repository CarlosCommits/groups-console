import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AppHeader, READY_TOOLTIP } from "./app-header";
import type { UpdateStatus } from "@/shared/contracts/updates";

function render(props: {
  title?: string;
  graphConnected?: boolean;
  exchangeActive?: boolean;
  updateStatus?: UpdateStatus | null;
}) {
  return renderToStaticMarkup(
    createElement(AppHeader, {
      title: props.title ?? "Dashboard",
      graphConnected: props.graphConnected ?? false,
      exchangeActive: props.exchangeActive ?? false,
      updateStatus: props.updateStatus ?? null,
    })
  );
}

describe("AppHeader", () => {
  it("renders the active page title", () => {
    const html = render({ title: "Directory Workspace" });
    expect(html).toContain("Directory Workspace");
  });

  it("does not render a search input", () => {
    const html = render({ graphConnected: false, exchangeActive: false });
    expect(html).not.toContain("Search resources");
  });

  it("does not render a bell/notification icon", () => {
    const html = render({ graphConnected: false, exchangeActive: false });
    expect(html).not.toContain("bell");
  });

  it("does not render avatar initials", () => {
    const html = render({ graphConnected: false, exchangeActive: false });
    expect(html).not.toContain("Avatar");
  });

  describe("when both graph and exchange are connected", () => {
    it("renders a single Ready badge and no individual status pills", () => {
      const html = render({ graphConnected: true, exchangeActive: true });
      expect(html).toContain("Ready");
      expect(html).not.toContain("Graph Connected");
      expect(html).not.toContain("Graph Offline");
      expect(html).not.toContain("Exchange Active");
      expect(html).not.toContain("Exchange Inactive");
    });

    it("uses the exact tooltip text for the combined badge", () => {
      expect(READY_TOOLTIP).toBe("Both exchange and graph connected");
    });
  });

  describe("updates", () => {
    const baseUpdateStatus = {
      currentVersion: "0.1.0",
      updateVersion: null,
      detail: null,
      checkedAt: null,
      canCheck: true,
      canInstall: false,
    } satisfies Omit<UpdateStatus, "state">;

    it("does not render an update button when no update is available", () => {
      const html = render({
        updateStatus: {
          ...baseUpdateStatus,
          state: "notAvailable",
          detail: "Groups Console is up to date.",
        },
      });
      expect(html).not.toContain("Update");
      expect(html).not.toContain("Downloading");
    });

    it("renders a disabled download state while an update is downloading", () => {
      const html = render({
        updateStatus: {
          ...baseUpdateStatus,
          state: "available",
          detail: "An update is available and is downloading.",
        },
      });
      expect(html).toContain("Downloading updates");
      expect(html).toContain("animate-bounce");
      expect(html).toContain("rounded-full");
      expect(html).toContain("bg-emerald-100/70");
      expect(html).toContain("disabled");
    });

    it("renders an update button when a downloaded update can be installed", () => {
      const html = render({
        updateStatus: {
          ...baseUpdateStatus,
          state: "downloaded",
          updateVersion: "0.1.1",
          detail: "An update has been downloaded. Restart Groups Console to install it.",
          canCheck: false,
          canInstall: true,
        },
      });
      expect(html).toContain("Update Available");
      expect(html).toContain("rounded-full");
      expect(html).toContain('data-variant="default"');
      expect(html).toContain("bg-primary");
      expect(html).toContain("font-bold");
      expect(html).not.toContain("disabled=\"\"");
    });

    it("renders an animated checking state while checking for updates", () => {
      const html = render({
        updateStatus: {
          ...baseUpdateStatus,
          state: "checking",
          detail: "Checking for updates.",
        },
      });
      expect(html).toContain("Checking for updates");
      expect(html).toContain("animate-spin");
      expect(html).toContain("rounded-full");
      expect(html).toContain("bg-amber-100/70");
      expect(html).toContain("disabled");
    });
  });

  describe("when not both connected", () => {
    it("renders Graph and Exchange status pills when graph is off", () => {
      const html = render({ graphConnected: false, exchangeActive: true });
      expect(html).toContain("Graph Offline");
      expect(html).toContain("Exchange Active");
      expect(html).not.toContain("Ready");
    });

    it("renders Graph and Exchange status pills when exchange is off", () => {
      const html = render({ graphConnected: true, exchangeActive: false });
      expect(html).toContain("Graph Connected");
      expect(html).toContain("Exchange Inactive");
      expect(html).not.toContain("Ready");
    });

    it("renders Graph and Exchange status pills when both are off", () => {
      const html = render({ graphConnected: false, exchangeActive: false });
      expect(html).toContain("Graph Offline");
      expect(html).toContain("Exchange Inactive");
      expect(html).not.toContain("Ready");
    });

    it("does not render a standalone Partial or Signed out badge", () => {
      const html = render({ graphConnected: false, exchangeActive: false });
      expect(html).not.toContain("Partial");
      expect(html).not.toContain("Signed out");
    });
  });
});
