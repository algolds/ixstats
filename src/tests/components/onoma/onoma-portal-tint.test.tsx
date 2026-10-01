import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, afterEach } from "@jest/globals";
import { OnomaPortalTint } from "~/app/labs/onoma/components/shared/OnomaPortalTint";
import { ONOMA_TINT_SLOTS } from "~/app/labs/onoma/onoma-tint";

afterEach(() => {
  document.body.removeAttribute("style");
});

describe("OnomaPortalTint", () => {
  it("mirrors the Onoma azure tint slots onto <body> so portals pick them up", () => {
    const { unmount } = render(<OnomaPortalTint />);
    for (const [name, value] of Object.entries(ONOMA_TINT_SLOTS)) {
      expect(document.body.style.getPropertyValue(name)).toBe(value);
    }
    unmount();
    for (const name of Object.keys(ONOMA_TINT_SLOTS)) {
      expect(document.body.style.getPropertyValue(name)).toBe("");
    }
  });

  it("restores a slot <body> already had", () => {
    document.body.style.setProperty("--tint-light", "#123456");
    const { unmount } = render(<OnomaPortalTint />);
    expect(document.body.style.getPropertyValue("--tint-light")).toBe("#0066b8");
    unmount();
    expect(document.body.style.getPropertyValue("--tint-light")).toBe("#123456");
  });
});
