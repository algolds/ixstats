import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/thinkpages-forum/reactions", () => ({
  ReactionBar: (props: {
    postId: string;
    counts: Record<string, number>;
    mine: string | null;
    canReact: boolean;
  }) => (
    <div
      data-testid="reaction-bar"
      data-post={props.postId}
      data-mine={props.mine ?? ""}
      data-can-react={String(props.canReact)}
      data-counts={JSON.stringify(props.counts)}
    />
  ),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/thinkpages-forum/ReportDialog", () => ({ ReportDialog: () => null }));
jest.mock("~/components/thinkpages-forum/ModeratorMenu", () => ({
  hasModeratorActions: () => false,
  ModeratorDialogs: () => null,
  ModeratorMenuItems: () => null,
}));

import { PostActions } from "~/components/thinkpages-forum/thread/PostActions";

const post = (over: object = {}) =>
  ({ id: "p1", reactions: { fire: 2 }, myReaction: "fire", ...over }) as never;

function actions(props: Partial<React.ComponentProps<typeof PostActions>> = {}) {
  return render(
    <PostActions
      post={post()}
      canReply
      onReply={jest.fn()}
      onQuote={jest.fn()}
      canEdit={false}
      onEdit={jest.fn()}
      canReport={false}
      canModerate={false}
      tools={null}
      onModeratorEdit={jest.fn()}
      canReact
      {...props}
    />
  );
}

describe("PostActions reactions", () => {
  it("mounts the reaction bar as the first control with the post's reactions", () => {
    actions();
    const bar = screen.getByTestId("reaction-bar");
    expect(bar.parentElement!.firstElementChild).toBe(bar);
    expect(bar).toHaveAttribute("data-post", "p1");
    expect(bar).toHaveAttribute("data-mine", "fire");
    expect(bar).toHaveAttribute("data-can-react", "true");
    expect(bar).toHaveAttribute("data-counts", '{"fire":2}');
  });

  it("passes the right to react through, and mounts the bar for a reader who cannot reply", () => {
    actions({ canReact: false, canReply: false });
    expect(screen.getByTestId("reaction-bar")).toHaveAttribute("data-can-react", "false");
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });
});
