import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AppHeader, READY_TOOLTIP } from "./app-header";

function render(props: {
  graphConnected?: boolean;
  exchangeActive?: boolean;
}) {
  return renderToStaticMarkup(
    createElement(AppHeader, {
      graphConnected: props.graphConnected ?? false,
      exchangeActive: props.exchangeActive ?? false,
    })
  );
}

describe("AppHeader", () => {
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
      expect(READY_TOOLTIP).toBe("both exchange and graph connected");
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