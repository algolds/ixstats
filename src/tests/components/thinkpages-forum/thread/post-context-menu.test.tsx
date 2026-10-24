import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ContextMenu, ContextMenuTrigger } from "~/components/ui/context-menu";
import { PostActions } from "~/components/thinkpages-forum/thread/PostActions";
import type { ForumPost } from "~/components/thinkpages-forum/thread/types";

jest.mock("~/trpc/react", () => ({ api: {} }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/thinkpages-forum/reactions", () => ({ ReactionBar: () => null }));

beforeAll(() => {
  class TestPointerEvent extends MouseEvent {}
  globalThis.PointerEvent ??= TestPointerEvent as typeof PointerEvent;
});

const post = { id: "p1" } as ForumPost;

function Post(props: { canReply: boolean; canEdit: boolean; onReply?: () => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article data-testid="post">
          <PostActions
            post={post}
            canReply={props.canReply}
            canReact={false}
            onReply={props.onReply ?? (() => {})}
            onQuote={() => {}}
            canEdit={props.canEdit}
            onEdit={() => {}}
            canReport={false}
            canModerate={false}
            tools={null}
            onModeratorEdit={() => {}}
          />
        </article>
      </ContextMenuTrigger>
    </ContextMenu>
  );
}

const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((i) => i.textContent);

describe("forum post right-click menu", () => {
  it("offers the row's actions, then the More actions items", () => {
    const onReply = jest.fn();
    render(<Post canReply canEdit onReply={onReply} />);
    fireEvent.contextMenu(screen.getByTestId("post"));
    const menu = screen.getByRole("menu");
    expect(itemsOf(menu)).toEqual(["Reply", "Quote", "Copy link", "Edit"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it("keeps Copy link for a reader who can only read", () => {
    render(<Post canReply={false} canEdit={false} />);
    fireEvent.contextMenu(screen.getByTestId("post"));
    expect(itemsOf(screen.getByRole("menu"))).toEqual(["Copy link"]);
    expect(screen.queryByRole("separator")).toBeNull();
  });
});
