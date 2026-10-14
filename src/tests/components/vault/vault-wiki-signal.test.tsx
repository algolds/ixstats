import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

let mockLinks: { data?: unknown };
jest.mock("~/trpc/react", () => ({
  api: { ixnayid: { listWikiLinks: { useQuery: () => mockLinks } } },
}));

import { VaultWikiSignal } from "~/components/vault/sections/dashboard/VaultWikiSignal";

describe("VaultWikiSignal", () => {
  it("asks an unlinked account to link its wiki account, as an info signal with one action", () => {
    mockLinks = { data: [] };
    render(<VaultWikiSignal />);
    const signal = screen.getByRole("status");
    expect(signal.getAttribute("data-content")).toBe("signal");
    expect(signal.textContent).toContain("Link your wiki account to earn from edits");
    const action = screen.getByRole("link", { name: "Link account" });
    expect(action.getAttribute("href")).toBe("/settings?tab=account#ixnayid-card");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("also shows for a link that is not yet verified", () => {
    mockLinks = { data: [{ source: "ixwiki", username: "Ixnay", verified: false, pending: true }] };
    render(<VaultWikiSignal />);
    expect(screen.getByRole("status")).not.toBeNull();
  });

  it("is absent once a wiki link is verified", () => {
    mockLinks = { data: [{ source: "ixwiki", username: "Ixnay", verified: true, pending: false }] };
    const { container } = render(<VaultWikiSignal />);
    expect(container.firstChild).toBeNull();
  });

  it("stays quiet while the links load, so a linked player never sees it flash", () => {
    mockLinks = { data: undefined };
    const { container } = render(<VaultWikiSignal />);
    expect(container.firstChild).toBeNull();
  });
});
