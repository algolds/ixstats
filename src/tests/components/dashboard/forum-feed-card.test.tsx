import "react";
import { render, screen } from "@testing-library/react";
import { ForumFeedCard } from "~/components/dashboard/sections/feed/ForumFeedCard";
import type { ForumFeedPreview } from "~/lib/thinkpages-forum/preview";

const NOW = Date.now();

function preview(over: Partial<ForumFeedPreview> = {}): ForumFeedPreview {
  return {
    threadId: "t1",
    title: "The Treaty of Aurelia",
    threadHref: "/thinkpages/t/t1",
    postHref: "/thinkpages/post/p1",
    kind: "thread",
    excerpt: "We propose a trade corridor between the two coasts.",
    author: {
      name: "jane",
      avatarUrl: null,
      flagUrl: "https://flags.example/eurth.png",
      persona: false,
      personaType: null,
    },
    board: { name: "General", href: "/thinkpages/c/general" },
    realm: null,
    style: "ooc",
    replyCount: 0,
    reactionTotal: 0,
    ...over,
  };
}

const card = (
  over: Partial<ForumFeedPreview> = {},
  timestamp: Date = new Date(NOW - 3 * 3_600_000)
) => render(<ForumFeedCard activity={{ timestamp, forum: preview(over) }} />);

describe("ForumFeedCard", () => {
  it("omits the time instead of throwing on a timestamp that does not parse", () => {
    const { container } = card({}, new Date("not a date"));
    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByText("jane")).toBeInTheDocument();
  });
});
