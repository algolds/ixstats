/** Reply scrolls to the composer and then puts the caret in its editor. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const order: string[] = [];
const focusEditor = jest.fn(() => order.push("focus"));

jest.mock("~/trpc/react", () => ({
  api: {
    forum: {
      getThread: {
        useQuery: () => ({
          isLoading: false,
          error: null,
          data: {
            thread: {
              threadId: 7,
              title: "Budget talks",
              authorName: "Ada",
              replyCount: 0,
              viewCount: 1,
              isOpen: true,
              forumName: "General",
              nodeId: 3,
            },
            posts: [],
            pagination: null,
          },
        }),
      },
      getLinkStatus: { useQuery: () => ({ data: null }) },
    },
  },
}));
jest.mock("~/components/forum/shared/ForumContext", () => ({
  useForumContext: () => ({ setForumPage: jest.fn() }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/forum/composer/ReplyComposer", () => ({
  ReplyComposer: ({ ref }: { ref?: React.Ref<{ focus: () => void }> }) => {
    React.useImperativeHandle(ref, () => ({ focus: focusEditor }), []);
    return <div data-testid="composer" />;
  },
}));

import { ThreadRenderer } from "~/components/forum/reader/ThreadRenderer";

describe("ThreadRenderer Reply", () => {
  it("scrolls the composer into view, then focuses its editor", () => {
    order.length = 0;
    const scroll = jest.fn(() => order.push("scroll"));
    window.HTMLElement.prototype.scrollIntoView = scroll;
    render(<ThreadRenderer threadId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(focusEditor).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["scroll", "focus"]);
  });
});
