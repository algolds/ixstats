/**
 * Settings offers "Sister wikis" (IIWiki and AltHistory) for verification; IxWiki is not offered, because an old IxWiki
 * name joins an account only through a claim. Covers the IxnayID panel and the IxnayID card.
 */
import { fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/hooks/useUserCountry", () => ({
  useUserCountry: () => ({ userProfile: null }),
}));
jest.mock("~/context/auth-context", () => ({ UserButton: () => null }));
jest.mock("~/components/settings/WikiNameClaims", () => ({ WikiNameClaims: () => null }));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/trpc/react", () => {
  const mutation = () => ({ mutate: jest.fn(), isPending: false, error: null });
  return {
    api: {
      useUtils: () => ({}),
      ixnayid: {
        getStatus: { useQuery: jest.fn() },
        listWikiLinks: { useQuery: jest.fn() },
        setHandle: { useMutation: mutation },
        linkDiscord: { useMutation: mutation },
        unlinkDiscord: { useMutation: mutation },
        startWikiVerification: { useMutation: mutation },
        confirmWikiVerification: { useMutation: mutation },
        unlinkWikiAccount: { useMutation: mutation },
      },
    },
  };
});
import { api } from "~/trpc/react";
import { AccountIdentityPanel } from "~/app/settings/_components/panels/AccountIdentityPanel";
import { IxnayIDCard } from "~/components/settings/IxnayIDCard";

const status = {
  passportHandle: "p1",
  handle: "p1",
  canChangeHandle: false,
  forum: { linked: false, username: null },
  // An old IxWiki link no longer counts as a connected wiki.
  wiki: { linked: true, username: "Old name" },
  discord: { linked: false, username: null, lastSync: null },
};

const link = (source: string, verified: boolean) => ({
  source,
  username: `${source} user`,
  verified,
  pending: false,
});

function mockData(links: object[]) {
  jest
    .mocked(api.ixnayid.getStatus.useQuery)
    .mockReturnValue({ data: status, isLoading: false } as never);
  jest.mocked(api.ixnayid.listWikiLinks.useQuery).mockReturnValue({ data: links } as never);
}

beforeEach(() => jest.clearAllMocks());

describe("AccountIdentityPanel", () => {
  it("lists the sister wikis and no IxWiki verify row", () => {
    mockData([]);
    render(<AccountIdentityPanel user={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByText("Sister wikis")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("IIWiki username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("AltHistory username")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Wiki username")).toBeNull();
    expect(screen.queryByText("Wikis")).toBeNull();
  });

  it("counts a verified sister wiki link as the wiki service, and an IxWiki link not at all", () => {
    mockData([link("ixwiki", true)]);
    const { unmount } = render(<AccountIdentityPanel user={null} />);
    expect(
      screen.getByText("0 of 3 connected (old forum, sister wikis, Discord)")
    ).toBeInTheDocument();
    unmount();
    mockData([link("ixwiki", true), link("althistory", true)]);
    render(<AccountIdentityPanel user={null} />);
    expect(
      screen.getByText("1 of 3 connected (old forum, sister wikis, Discord)")
    ).toBeInTheDocument();
  });
});

describe("IxnayIDCard", () => {
  it("has no IxWiki verify row", () => {
    mockData([link("ixwiki", true)]);
    render(<IxnayIDCard />);
    expect(screen.getByText("Discord")).toBeInTheDocument();
    expect(screen.queryByText("Wiki")).toBeNull();
    expect(screen.queryByPlaceholderText("Wiki username")).toBeNull();
    expect(screen.queryByText("ixwiki user")).toBeNull();
  });
});
