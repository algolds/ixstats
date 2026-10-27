import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ContextMenu, ContextMenuTrigger } from "~/components/ui/context-menu";
import { hasMessageActions, MessageMenu } from "~/components/thinkpages-forum/realm/MessageMenu";
import type { BoardAccess, BoardMessageData } from "~/components/thinkpages-forum/realm/types";

jest.mock("~/trpc/react", () => ({ api: {} }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const theirs = { id: "m1", byViewer: false, canEdit: false, hidden: false } as BoardMessageData;
const member = { canPost: true, isVisitor: false, isModerator: false } as BoardAccess;
const visitor = { canPost: false, isVisitor: true, isModerator: false } as BoardAccess;

describe("realm message right-click menu", () => {
  it("leads with Reply and Quote, then the More actions items", () => {
    const onReply = jest.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <article data-testid="message">
            <MessageMenu
              message={theirs}
              access={member}
              signedIn
              tools={null}
              onEdit={() => {}}
              onChanged={() => {}}
              onReply={onReply}
              onQuote={() => {}}
            />
          </article>
        </ContextMenuTrigger>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByTestId("message"));
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["Reply", "Quote", "Report"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it("has nothing to offer a signed-out visitor, so the browser keeps its menu", () => {
    expect(hasMessageActions(theirs, visitor, false, null)).toBe(false);
    expect(hasMessageActions(theirs, visitor, true, null)).toBe(true);
    expect(hasMessageActions(theirs, member, false, null)).toBe(true);
  });
});
