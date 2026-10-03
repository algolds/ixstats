import { act, render, screen } from "@testing-library/react";

const createPost = { isPending: false, mutate: jest.fn() };
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: { createPost: { useMutation: () => createPost } },
    achievements: {
      getRecentByCountry: {
        useQuery: () => ({ data: [{ id: "a1", title: "Moon landing", description: null }] }),
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/components/mycountry/dossier/useCountryDiplomacyActions", () => ({
  useCountryDiplomacyActions: () => ({
    isFollowing: false,
    isFollowPending: false,
    isEmbassyPending: false,
    isPending: false,
    toggleFollow: jest.fn(),
    establishEmbassy: jest.fn(),
    proposeForeignPolicy: jest.fn(),
  }),
}));
jest.mock("~/components/executive/actions/MeetingScheduler", () => ({
  MeetingScheduler: () => null,
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";

const DIPLOMACY_LABELS = [
  "Construct Embassy",
  "Request meeting",
  "Propose free trade",
  "Propose military alliance",
  "Impose sanctions",
  "Declare embargo",
  "Unfollow Nation",
  "Follow Nation",
];

describe("CountryActionsMenu while a congratulation is sending", () => {
  const renderMenu = () =>
    render(
      <CountryActionsMenu
        targetCountryId="t1"
        targetCountryName="Pelaxia"
        viewerCountryId="v1"
        isOpen
        onClose={jest.fn()}
      />
    );

  it("leaves the diplomacy rows enabled when nothing is pending", () => {
    createPost.isPending = false;
    renderMenu();
    expect(screen.getByRole("button", { name: /Construct Embassy/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Impose sanctions/ })).toBeEnabled();
  });

  it("disables every diplomacy row so a second action cannot be double-submitted", () => {
    createPost.isPending = true;
    renderMenu();
    const rows = DIPLOMACY_LABELS.flatMap((label) =>
      screen.queryAllByRole("button", { name: new RegExp(label) })
    );
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) expect(row).toBeDisabled();
    act(() => {
      createPost.isPending = false;
    });
  });
});
