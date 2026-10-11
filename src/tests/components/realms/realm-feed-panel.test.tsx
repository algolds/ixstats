import React from "react";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

let mockViewerRealmId: string | null = null;
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => mockViewerRealmId }));
jest.mock("~/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/app/r/[realm]/_components/RealmFeed", () => ({
  RealmFeed: ({ realmId, realmSlug }: { realmId: string | null; realmSlug?: string | null }) => (
    <p>
      feed {realmId ?? "all"} slug {realmSlug ?? "none"}
    </p>
  ),
}));

import { RealmFeedPanel } from "~/app/realms/_components/RealmFeedPanel";
import type { DirectoryRealm } from "~/app/realms/_components/realm-directory";

const realms = [
  { id: "r_eurth", slug: "eurth", name: "Eurth" },
  { id: "r_quiet", slug: "quiet", name: "Quiet" },
] as DirectoryRealm[];

beforeEach(() => {
  mockViewerRealmId = null;
});

describe("RealmFeedPanel", () => {
  it("hands the feed the selected realm's slug from the directory list", () => {
    mockViewerRealmId = "r_quiet";
    render(<RealmFeedPanel realms={realms} />);
    expect(screen.getByText("feed r_quiet slug quiet")).toBeInTheDocument();
  });

  it("gives no slug for every realm, a viewer realm missing from the list, or an unloaded list", () => {
    const all = render(<RealmFeedPanel realms={realms} />);
    expect(all.getByText("feed all slug none")).toBeInTheDocument();
    all.unmount();
    mockViewerRealmId = "r_hidden";
    const missing = render(<RealmFeedPanel realms={realms} />);
    expect(missing.getByText("feed r_hidden slug none")).toBeInTheDocument();
    missing.unmount();
    mockViewerRealmId = "r_eurth";
    render(<RealmFeedPanel realms={undefined} />);
    expect(screen.getByText("feed r_eurth slug none")).toBeInTheDocument();
  });
});
