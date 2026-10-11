import React from "react";
import { render, screen, within } from "@testing-library/react";
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
  it("shows the author row, the title, the excerpt and the footer of a new thread", () => {
    const { container } = card();
    expect(screen.getByText("jane")).toBeInTheDocument();
    expect(screen.getByText(/started a thread in/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/thinkpages/c/general"
    );
    expect(container.querySelector("img[src='https://flags.example/eurth.png']")).not.toBeNull();
    expect(screen.getByText("3h ago")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The Treaty of Aurelia" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    const excerpt = screen.getByText("We propose a trade corridor between the two coasts.");
    expect(excerpt).toHaveClass("line-clamp-3");
    expect(screen.getByText("0 replies")).toBeInTheDocument();
    expect(screen.queryByText(/reaction/)).toBeNull();
    expect(screen.getByRole("link", { name: "Open thread" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p1"
    );
  });

  it("says a reply was a reply, and pluralizes the footer counts", () => {
    const first = card({ kind: "reply", replyCount: 1, reactionTotal: 1 });
    expect(screen.getByText(/replied in/)).toBeInTheDocument();
    expect(screen.getByText("1 reply")).toBeInTheDocument();
    expect(screen.getByText("1 reaction")).toBeInTheDocument();
    first.unmount();
    card({ replyCount: 12, reactionTotal: 7 });
    expect(screen.getByText("12 replies")).toBeInTheDocument();
    expect(screen.getByText("7 reactions")).toBeInTheDocument();
  });

  it("sets an in-character title in the reading font and marks the board as in character", () => {
    card({ style: "ic" });
    expect(screen.getByRole("heading", { name: "The Treaty of Aurelia" })).toHaveClass(
      "font-(family-name:--wikios-font-reading)"
    );
    expect(screen.getByText("In character")).toBeInTheDocument();
  });

  it("sets an out-of-character title in the interface font", () => {
    card({ style: "ooc" });
    expect(screen.getByRole("heading", { name: "The Treaty of Aurelia" })).not.toHaveClass(
      "font-(family-name:--wikios-font-reading)"
    );
    expect(screen.queryByText("In character")).toBeNull();
  });

  it("shows a persona by name and initials, with no flag", () => {
    const { container } = card({
      author: { name: "Eurth Daily", avatarUrl: null, flagUrl: null, persona: true },
    });
    expect(screen.getByText("Eurth Daily")).toBeInTheDocument();
    expect(screen.getByText("ED")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("names the realm beside the board, with its emblem", () => {
    const { container } = card({
      realm: {
        slug: "eurth",
        name: "Eurth",
        emblemUrl: "https://img.example/e.png",
        thumbnail: null,
      },
      board: { name: "Character Threads", href: "/thinkpages/r/eurth/character-threads" },
    });
    expect(screen.getByText("Eurth")).toBeInTheDocument();
    expect(container.querySelector("img[src='https://img.example/e.png']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Character Threads" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/character-threads"
    );
  });

  it("keeps the board link reachable: it is never inside a truncating container", () => {
    card({ board: { name: "A very long board name", href: "/thinkpages/c/long" } });
    const link = screen.getByRole("link", { name: "A very long board name" });
    expect(link.closest(".truncate")).toBeNull();
    expect(link).toHaveClass("pointer-coarse:min-h-11");
  });

  it("gives the title link a coarse-pointer touch target", () => {
    card();
    expect(screen.getByRole("link", { name: "The Treaty of Aurelia" })).toHaveClass(
      "pointer-coarse:min-h-11"
    );
  });

  it("omits the time instead of throwing on a timestamp that does not parse", () => {
    const { container } = card({}, new Date("not a date"));
    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByText("jane")).toBeInTheDocument();
  });

  it("falls back to the realm thumbnail when the realm has no emblem", () => {
    const { container } = card({
      realm: {
        slug: "eurth",
        name: "Eurth",
        emblemUrl: null,
        thumbnail: "https://img.example/t.png",
      },
    });
    expect(container.querySelector("img[src='https://img.example/t.png']")).not.toBeNull();
  });

  it("omits the excerpt line when the post has no text", () => {
    const { container } = card({ excerpt: "" });
    expect(container.querySelector(".line-clamp-3")).toBeNull();
  });

  it("keeps a 200-character title inside the card", () => {
    card({ title: "T".repeat(200) });
    expect(screen.getByRole("heading")).toHaveClass("break-words");
  });

  it("gives the whole card one article landmark", () => {
    card();
    const article = screen.getByRole("article");
    expect(within(article).getByRole("heading")).toBeInTheDocument();
  });
});
