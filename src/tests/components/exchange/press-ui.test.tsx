/** Business press UI: a story from ThinkPages opens the post, and the founder links only corporate accounts. */
import { fireEvent, render, screen } from "@testing-library/react";

const mockLink = jest.fn();
const mockUnlink = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: {
      getMyAccounts: {
        useQuery: () => ({
          data: [
            {
              id: "acc_corp",
              accountType: "corporate",
              displayName: "Alice Works PR",
              username: "aliceworks",
            },
            {
              id: "acc_media",
              accountType: "media",
              displayName: "Caphiria Daily",
              username: "daily",
            },
          ],
        }),
      },
    },
    exchange: {
      linkCompanyAccount: { useMutation: () => ({ mutate: mockLink, isPending: false }) },
      unlinkCompanyAccount: { useMutation: () => ({ mutate: mockUnlink, isPending: false }) },
    },
  },
}));

import { CompanyPressControls } from "~/components/exchange/CompanyPressControls";
import { NewsList } from "~/components/exchange/terminal/NewsList";
import type { NewsItem } from "~/lib/exchange/terminal";

const item = (over: Partial<NewsItem>): NewsItem => ({
  id: "n1",
  realmId: "default",
  kind: "trade",
  prominence: "HEADLINE",
  sourceKind: "EXCHANGE",
  sourceId: null,
  headline: "Steel rallies",
  body: null,
  companyId: null,
  bondId: null,
  countryId: null,
  contractId: null,
  movePct: null,
  createdAt: new Date(),
  sourceName: "Exchange",
  ...over,
});

describe("NewsList", () => {
  it("opens a ThinkPages story at its post and an Exchange story at its page", () => {
    render(
      <NewsList
        emphasis="headline"
        empty="None"
        items={[
          item({ id: "post:p1", headline: "Record quarter", href: "/dashboard/post/p1" }),
          item({ id: "n2", headline: "Steel rallies" }),
        ]}
      />
    );
    expect(screen.getByRole("link", { name: /Record quarter/ })).toHaveAttribute(
      "href",
      "/dashboard/post/p1"
    );
    expect(screen.getByRole("link", { name: /Steel rallies/ })).toHaveAttribute(
      "href",
      "/exchange/s/n2"
    );
  });
});

describe("CompanyPressControls", () => {
  beforeEach(() => {
    mockLink.mockReset();
    mockUnlink.mockReset();
  });

  it("offers only corporate accounts", () => {
    render(
      <CompanyPressControls
        company={{ id: "co1", name: "Alice Works", thinkpagesAccountId: null }}
        onDone={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Press account for Alice Works" }));
    expect(screen.getByRole("option", { name: "Alice Works PR" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Caphiria Daily" })).not.toBeInTheDocument();
  });

  it("unlinks a linked account", () => {
    render(
      <CompanyPressControls
        company={{ id: "co1", name: "Alice Works", thinkpagesAccountId: "acc_corp" }}
        onDone={jest.fn()}
      />
    );
    expect(screen.getByText("@aliceworks speaks for Alice Works.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(mockUnlink).toHaveBeenCalledWith({ companyId: "co1" });
  });
});
