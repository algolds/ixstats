import { render, screen } from "@testing-library/react";
import { WikiFeedCard } from "~/components/dashboard/sections/feed/WikiFeedCard";
import { InlineWikiArticlePreview } from "~/components/dashboard/sections/feed/InlineWikiArticlePreview";
import { api } from "~/trpc/react";

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/components/thinkpages/RepostModal", () => ({ RepostModal: () => null }));

// Plan 416: Margin is paged (50 threads), so the badge shows the server's count, not the page's length.
const marginQuery = api.wikios.getArticleMarginData.useQuery as jest.Mock;
const defaultMarginQuery = marginQuery.getMockImplementation();

const page = (totalOpenCount: number) => ({
  data: {
    threads: Array.from({ length: 50 }, (_, i) => ({ id: `t${i}` })),
    totalOpenCount,
    totalResolvedCount: 9,
  },
});

// The cards read lists with an empty default, which the global mock's `data: null` would bypass.
const asLists = () => {
  const empty = { data: [] };
  (api.wikios.getStashes.useQuery as jest.Mock).mockReturnValue(empty);
  (api.thinkpages.getMyAccounts.useQuery as jest.Mock).mockReturnValue(empty);
  (api.wikios.getIntro.useQuery as jest.Mock).mockReturnValue({
    data: { intro: "Caphiria is a nation." },
  });
};

const activity = {
  id: "a1",
  type: "wiki_edit",
  createdAt: new Date("2026-09-01T00:00:00Z").toISOString(),
  content: { title: "Caphiria", metadata: { pageTitle: "Caphiria" } },
};

describe.each([
  ["WikiFeedCard", () => render(<WikiFeedCard activity={activity} />)],
  ["InlineWikiArticlePreview", () => render(<InlineWikiArticlePreview title="Caphiria" />)],
])("%s Margin badge", (_name, renderCard) => {
  beforeEach(asLists);
  afterEach(() => marginQuery.mockImplementation(defaultMarginQuery));

  it("shows the open thread count the server reports, not the length of the page it sent", () => {
    marginQuery.mockReturnValue(page(73));

    renderCard();

    expect(screen.getByText("73")).toBeInTheDocument();
    expect(screen.queryByText("50")).not.toBeInTheDocument();
  });

  it("shows no badge while the count is unknown or zero", () => {
    marginQuery.mockReturnValue({ data: undefined });

    renderCard();

    expect(screen.getByText("Margin")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
