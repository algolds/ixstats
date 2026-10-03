import { render, screen } from "@testing-library/react";
import { HeroPostView } from "~/components/thinkpages/post/HeroPostView";
import type { PostState, PostViewContext } from "~/components/thinkpages/post/postViewTypes";

jest.mock("motion/react", () => ({
  motion: { div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
}));
jest.mock("~/lib/design/motion", () => ({ springGentle: {} }));
jest.mock("~/components/thinkpages/post/PostBody", () => ({ PostBody: () => null }));
jest.mock("~/components/thinkpages/post/PostMediaGrid", () => ({ PostMediaGrid: () => null }));
jest.mock("~/components/thinkpages/post/PostEmbeds", () => ({ PostEmbeds: () => null }));
jest.mock("~/components/thinkpages/primitives/PostActions", () => ({ PostActions: () => null }));
jest.mock("~/components/thinkpages/PersonaAuthorCard", () => ({
  PersonaAuthorCard: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
// Edit, Delete and Report menu items only set state; these two components are what show it.
jest.mock("~/components/thinkpages/post/PostComposers", () => ({
  PostComposers: () => <div data-testid="post-composers" />,
}));
jest.mock("~/components/thinkpages/post/PostModals", () => ({
  PostModals: () => <div data-testid="post-modals" />,
}));

const post = {
  id: "p1",
  content: "Hello",
  timestamp: "2026-01-01T00:00:00Z",
  account: { id: "a1", username: "ada", displayName: "Ada", accountType: "PERSONAL" },
};

describe("HeroPostView", () => {
  it("renders the edit composer and the delete/report/reactions modals its menu opens", () => {
    const state = {
      showMoreOptions: false,
      setShowMoreOptions: jest.fn(),
      canEdit: true,
      canDelete: true,
      isOwnPost: true,
    } as unknown as PostState;
    const ctx = { currentUserAccountId: "a1" } as PostViewContext;

    render(<HeroPostView post={post} ctx={ctx} state={state} />);

    expect(screen.getByTestId("post-composers")).toBeInTheDocument();
    expect(screen.getByTestId("post-modals")).toBeInTheDocument();
  });
});
