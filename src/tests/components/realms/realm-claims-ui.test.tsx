/**
 * AT-5: claimants see their claims. "Your claims" lists each claim's status and a rejection's reason, and a
 * claimable nation the player claimed shows "Pending review", or the rejection with "Claim again".
 */
import React from "react";
import { render, screen } from "@testing-library/react";

const queries: Record<string, unknown> = {};

function apiProxy(path: string[] = []): unknown {
  return new Proxy(() => undefined, {
    get: (_t, prop: string) => {
      if (prop === "useQuery") return () => ({ data: queries[path.join(".")], isLoading: false });
      if (prop === "useMutation") return () => ({ mutate: jest.fn(), isPending: false });
      if (prop === "useUtils") return () => apiProxy(["utils"]);
      if (prop === "invalidate") return jest.fn();
      return apiProxy([...path, prop]);
    },
  });
}
jest.mock("~/trpc/react", () => ({ api: apiProxy() }));
let signedIn = true;
jest.mock("~/context/auth-context", () => ({ useAuth: () => ({ isSignedIn: signedIn }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

import { MyClaims } from "~/app/r/[realm]/_components/MyClaims";
import { ClaimableNations } from "~/app/r/[realm]/_components/ClaimableNations";

const claim = (overrides: Record<string, unknown>) => ({
  id: "cl1",
  status: "pending",
  autoApproved: false,
  rejectionReason: null,
  wikiPageTitle: "Aurelia",
  createdAt: new Date(),
  reviewedAt: null,
  realm: { name: "Eurth", slug: "eurth" },
  country: null,
  ...overrides,
});

beforeEach(() => {
  signedIn = true;
  for (const key of Object.keys(queries)) delete queries[key];
});

describe("Your claims", () => {
  it("lists each claim with its status and a rejection's reason", () => {
    queries["realms.myClaims"] = [
      claim({ id: "a", wikiPageTitle: "Aurelia" }),
      claim({
        id: "b",
        wikiPageTitle: "Borea",
        status: "rejected",
        rejectionReason: "Not your page",
        reviewedAt: new Date(),
      }),
      claim({
        id: "c",
        status: "approved",
        wikiPageTitle: "Corvia",
        country: { id: "c3", name: "Corvia", slug: "corvia" },
        reviewedAt: new Date(),
      }),
    ];
    render(<MyClaims />);
    expect(screen.getByRole("heading", { name: "Your claims · 3" })).toBeTruthy();
    expect(screen.getByText("Pending review")).toBeTruthy();
    expect(screen.getByText("Rejected")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Reason: Not your page")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Corvia" }).getAttribute("href")).toContain(
      "/countries/corvia"
    );
    // Across realms, each claim names its realm.
    expect(screen.getAllByRole("link", { name: "Eurth" })).toHaveLength(3);
  });

  it("shows nothing when signed out or without claims", () => {
    queries["realms.myClaims"] = [];
    const { container, rerender } = render(<MyClaims realmSlug="eurth" />);
    expect(container.textContent).toBe("");
    signedIn = false;
    queries["realms.myClaims"] = [claim({})];
    rerender(<MyClaims realmSlug="eurth" />);
    expect(container.textContent).toBe("");
  });
});

describe("claimable nations with the viewer's claims", () => {
  const pages = [
    { title: "Aurelia", wikiSource: "iiwiki" },
    { title: "Borea", wikiSource: "iiwiki" },
    { title: "Corvia", wikiSource: "iiwiki" },
  ];

  it("marks a pending claim and offers a rejected one again, with the reason", () => {
    queries["realms.myClaims"] = [
      claim({ id: "a", wikiPageTitle: "Aurelia" }),
      claim({ id: "b2", wikiPageTitle: "Borea", status: "rejected", rejectionReason: "Duplicate" }),
    ];
    render(<ClaimableNations realmSlug="eurth" pages={pages} />);
    const aurelia = screen.getByRole("button", { name: "Claim Aurelia" });
    expect(aurelia.textContent).toBe("Pending review");
    expect((aurelia as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Claim Borea" }).textContent).toBe("Claim again");
    expect(screen.getByText("Your claim was rejected: Duplicate")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim Corvia" }).textContent).toBe("Claim");
  });
});
