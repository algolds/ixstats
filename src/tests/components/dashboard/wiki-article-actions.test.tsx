/**
 * The feed's wiki action toolbar (shared by WikiFeedCard and InlineWikiArticlePreview) is a row of
 * ActionPills: Margin / Repost / Like / Save to Stash / Share.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mockStash = jest.fn();
let mockStashed = false;
let mockThreads: unknown[] = [];

jest.mock("~/trpc/react", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data }) });
  const mutation = (mutate: (...args: unknown[]) => void = () => undefined) => ({
    useMutation: () => ({ mutate, isPending: false }),
  });
  return {
    api: {
      useUtils: () => ({
        wikios: {
          isStashed: { invalidate: jest.fn() },
          getStashes: { invalidate: jest.fn() },
          getArticleMarginData: { invalidate: jest.fn() },
        },
      }),
      wikios: {
        get isStashed() {
          return query({ stashed: mockStashed, stashes: [] });
        },
        getStashes: query([]),
        get getArticleMarginData() {
          // the server reports the open-thread count itself (the threads are one page of them)
          return query({ threads: mockThreads, totalOpenCount: mockThreads.length });
        },
        stashPage: mutation((...args) => mockStash(...args)),
        unstashPage: mutation(),
        createThread: mutation(),
      },
      thinkpages: { getMyAccounts: query([]) },
      users: { getProfile: query(null) },
    },
  };
});
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u1" } }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/thinkpages/RepostModal", () => ({
  RepostModal: () => <div role="dialog" aria-label="Repost" />,
}));

import { WikiArticleActions } from "~/components/dashboard/sections/feed/WikiArticleActions";

beforeEach(() => {
  mockStash.mockReset();
  mockStashed = false;
  mockThreads = [];
});

const pills = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-slot="action-pill"]'));

describe("WikiArticleActions", () => {
  it("renders the five actions as ActionPills, with the trailing slot", () => {
    const { container } = render(
      <WikiArticleActions title="Caphiria" trailing={<a href="/wiki/Caphiria">Open in Wiki</a>} />
    );
    expect(pills(container)).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Margin/ })).toHaveAttribute("aria-pressed", "false");
    // Repost and Share are one-shot actions.
    expect(screen.getByRole("button", { name: "Repost" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Share" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("link", { name: "Open in Wiki" })).toBeInTheDocument();
  });

  it("likes with the red tone and a count", () => {
    render(<WikiArticleActions title="Caphiria" />);
    const like = screen.getByRole("button", { name: /Like/ });
    expect(like).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveAttribute("data-tone", "red");
    expect(like.className).toContain("text-red-ink");
    expect(like.querySelector('[data-slot="action-pill-count"]')?.textContent).toBe("1");
  });

  it("opens the margin composer from the pressed Margin pill and shows the thread count", () => {
    mockThreads = [{}, {}];
    render(<WikiArticleActions title="Caphiria" />);
    const margin = screen.getByRole("button", { name: /Margin/ });
    expect(margin.textContent).toContain("2");
    fireEvent.click(margin);
    expect(margin).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Margin note" })).toBeInTheDocument();
  });

  it("stashes the article, and shows the saved state when stashed", () => {
    const { unmount } = render(<WikiArticleActions title="Caphiria" />);
    fireEvent.click(screen.getByRole("button", { name: "Save to Stash" }));
    expect(mockStash).toHaveBeenCalledWith({ pageTitle: "Caphiria" });
    unmount();

    mockStashed = true;
    render(<WikiArticleActions title="Caphiria" />);
    const saved = screen.getByRole("button", { name: "Saved" });
    expect(saved).toHaveAttribute("aria-pressed", "true");
    expect(saved.className).toContain("bg-tint-fill");
  });
});
