/** @jest-environment node */
/** The Exchange lives under Labs; the old Vault address is only a redirect. */
class RouteSignal extends Error {}
const mockRedirect = jest.fn((url: string) => {
  throw new RouteSignal(url);
});
jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import fs from "fs";
import path from "path";
import VaultExchangePage from "~/app/vault/exchange/page";

describe("/vault/exchange", () => {
  it("redirects to /labs/exchange", () => {
    expect(() => VaultExchangePage()).toThrow(RouteSignal);
    expect(mockRedirect).toHaveBeenCalledWith("/labs/exchange");
  });

  it("has a Labs page that renders the Exchange", () => {
    const page = path.resolve(__dirname, "../../../app/labs/exchange/page.tsx");
    expect(fs.readFileSync(page, "utf8")).toContain("ExchangeSection");
  });
});
