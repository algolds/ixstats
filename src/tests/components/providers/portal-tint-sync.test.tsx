import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, afterEach } from "@jest/globals";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

afterEach(() => {
  delete document.body.dataset.app;
});

describe("PortalTintSync", () => {
  it("mirrors the app scope onto <body> so portals inherit the tint", () => {
    const { unmount } = render(
      <div data-app="mycountry">
        <PortalTintSync />
      </div>
    );
    expect(document.body.dataset.app).toBe("mycountry");
    unmount();
    expect(document.body.dataset.app).toBeUndefined();
  });

  it("uses the deepest scope when scopes nest", () => {
    const { rerender } = render(
      <div data-app="mycountry">
        <PortalTintSync />
        <div data-app="thinkpages">
          <PortalTintSync />
        </div>
      </div>
    );
    expect(document.body.dataset.app).toBe("thinkpages");

    rerender(
      <div data-app="mycountry">
        <PortalTintSync />
      </div>
    );
    expect(document.body.dataset.app).toBe("mycountry");
  });
});
