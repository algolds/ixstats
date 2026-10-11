import React from "react";
import { render, screen } from "@testing-library/react";

const mockAdvert: {
  data?: { threadId: string | null; hiddenByModerator: boolean };
  isLoading?: boolean;
} = {};
let mockSlug = "";

jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      advertFor: {
        useQuery: (input: { realm: string }) => {
          mockSlug = input.realm;
          return { isLoading: false, ...mockAdvert };
        },
      },
    },
  },
}));

import { AdvertSection } from "~/app/r/[realm]/_components/manage/AdvertSection";

beforeEach(() => {
  delete mockAdvert.data;
  delete mockAdvert.isLoading;
  mockSlug = "";
});

describe("the Manage page's Advert row", () => {
  it("links the advert the realm already has", () => {
    mockAdvert.data = { threadId: "t_ad", hiddenByModerator: false };
    render(<AdvertSection slug="eurth" realmId="r_eurth" archived={false} />);
    expect(screen.getByRole("heading", { name: "Advert" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_ad"
    );
    expect(screen.queryByRole("link", { name: "Create advert" })).toBeNull();
    expect(mockSlug).toBe("eurth");
  });

  it("offers Create advert, opening the form for this realm, when there is none", () => {
    mockAdvert.data = { threadId: null, hiddenByModerator: false };
    render(<AdvertSection slug="a-b" realmId="r_ab" archived={false} />);
    expect(screen.getByRole("link", { name: "Create advert" })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm/new?advert=a-b"
    );
  });

  it("offers no Create for an archived realm, but still links an advert it has", () => {
    mockAdvert.data = { threadId: null, hiddenByModerator: false };
    const none = render(<AdvertSection slug="eurth" realmId="r_eurth" archived />);
    expect(screen.queryByRole("link", { name: "Create advert" })).toBeNull();
    expect(screen.getByText("An archived realm cannot be advertised.")).toBeInTheDocument();
    none.unmount();
    mockAdvert.data = { threadId: "t_ad", hiddenByModerator: false };
    render(<AdvertSection slug="eurth" realmId="r_eurth" archived />);
    expect(screen.getByRole("link", { name: "Open the advert" })).toBeInTheDocument();
  });

  it("says a moderator hid the advert, with no link and no Create", () => {
    mockAdvert.data = { threadId: null, hiddenByModerator: true };
    render(<AdvertSection slug="eurth" realmId="r_eurth" archived={false} />);
    expect(screen.getByText("Your advert was hidden by a moderator.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says so while loading and when the advert could not be read", () => {
    mockAdvert.isLoading = true;
    const loading = render(<AdvertSection slug="eurth" realmId="r_eurth" archived={false} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    loading.unmount();
    delete mockAdvert.isLoading;
    render(<AdvertSection slug="eurth" realmId="r_eurth" archived={false} />);
    expect(screen.getByText("The advert could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create advert" })).toBeNull();
  });

  it("says Ixnay cannot be advertised and never queries the advert", () => {
    mockAdvert.data = { threadId: "t_ad", hiddenByModerator: false };
    render(<AdvertSection slug="ixnay" realmId="default" archived={false} />);
    expect(screen.getByText("Ixnay cannot be advertised in Find a Realm.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(mockSlug).toBe("");
  });
});
