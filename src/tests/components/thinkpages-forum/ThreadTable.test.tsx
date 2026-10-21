import React from "react";
import { render, screen, within } from "@testing-library/react";

// Radix Avatar renders an image only once the browser has loaded it; show it at once.
jest.mock("~/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-slot="avatar" className={className}>
      {children}
    </span>
  ),
  AvatarImage: ({ src }: { src: string }) => <img src={src} alt="" />,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import { ThreadTable } from "~/components/thinkpages-forum/board";
import type { ForumAuthors } from "~/components/thinkpages-forum/AuthorName";

const BASE = "/thinkpages/c/general";

const authors = {
  users: {
    u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: "/flags/kir.png" },
    u2: { name: "Hidden Player", handle: null, avatarUrl: null, flagUrl: "/flags/hidden.png" },
  },
  personas: {
    pa: {
      displayName: "Aria Vance",
      username: "aria",
      avatarUrl: "/avatars/aria.png",
      personaType: "citizen",
    },
  },
} as ForumAuthors;

function thread(id: string, extra: object = {}) {
  return {
    id,
    title: `Thread ${id}`,
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    xenforoThreadId: null,
    pinned: false,
    locked: false,
    hidden: false,
    postCount: 3,
    lastPostAt: new Date(),
    ...extra,
  };
}

function renderTable(threads: object[], sort: "latest" | "newest" | "replies" = "latest") {
  return render(
    <ThreadTable threads={threads as never} authors={authors} basePath={BASE} sort={sort} />
  );
}

const rowOf = (name: RegExp) => screen.getByRole("row", { name });

describe("ThreadTable columns and sorting", () => {
  it("has Thread / Replies / Last post columns, each a sort link to ?sort=", () => {
    renderTable([thread("t1")]);
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Thread", "Replies", "Last post"]);
    expect(within(headers[0]!).getByRole("link")).toHaveAttribute("href", `${BASE}?sort=newest`);
    expect(within(headers[1]!).getByRole("link")).toHaveAttribute("href", `${BASE}?sort=replies`);
    expect(within(headers[2]!).getByRole("link")).toHaveAttribute("href", BASE);
  });
});

describe("ThreadTable rows", () => {
  it("links the title to the thread and shows replies as posts minus one", () => {
    renderTable([thread("t1", { postCount: 3 })]);
    const row = rowOf(/Thread t1/);
    expect(within(row).getByRole("link", { name: "Thread t1" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("shows titles as text, never markup", () => {
    renderTable([thread("t1", { title: "<i>Hi</i>" })]);
    expect(screen.getByText("<i>Hi</i>")).toBeInTheDocument();
  });
  describe("last post", () => {
    const lastCell = (name: RegExp) => within(rowOf(name)).getAllByRole("cell")[2]!;

    it("shows who wrote the last post with their avatar and when, not the thread's starter", () => {
      renderTable([
        thread("t1", {
          authorUserId: "u1",
          lastPoster: { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null },
        }),
      ]);
      const cell = lastCell(/Thread t1/);
      expect(within(cell).getByText("Hidden Player")).toBeInTheDocument();
      expect(within(cell).queryByText("Kir")).toBeNull();
      expect(cell.querySelector('[data-slot="avatar"]')).not.toBeNull();
      expect(within(cell).getByText(/ago|now|just/i)).toBeInTheDocument();
    });

    it("names a persona's last post by the persona and its picture, never the player", () => {
      renderTable([
        thread("t1", {
          lastPoster: { authorUserId: null, authorPersonaId: "pa", importedAuthorName: null },
        }),
      ]);
      const cell = lastCell(/Thread t1/);
      expect(within(cell).getByText("Aria Vance")).toBeInTheDocument();
      expect(cell.querySelector('img[src="/avatars/aria.png"]')).not.toBeNull();
      expect(cell.querySelector('img[src^="/flags/"]')).toBeNull();
    });
  });
  it("names the persona, with its avatar and no flag, never the player behind it", () => {
    renderTable([thread("t1", { authorUserId: "u2", authorPersonaId: "pa" })]);
    const row = rowOf(/Thread t1/);
    expect(within(row).getByText("Aria Vance")).toBeInTheDocument();
    expect(within(row).queryByText("Hidden Player")).toBeNull();
    expect(row.querySelector('img[src="/flags/hidden.png"]')).toBeNull();
    expect(row.querySelector('img[src="/avatars/aria.png"]')).not.toBeNull();
  });
});

describe("ThreadTable page shortcuts", () => {
  it("links the pages of a multi-page thread", () => {
    // 45 posts at 20 a page: 3 pages.
    renderTable([thread("t1", { postCount: 45 })]);
    const row = rowOf(/Thread t1/);
    expect(within(row).getByRole("link", { name: "Page 2 of Thread t1" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1?page=2"
    );
    expect(within(row).getByRole("link", { name: "Page 3 of Thread t1" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1?page=3"
    );
  });
});

describe("ThreadTable unread rows", () => {
  it("shows an unread thread in semibold with a dot, and links it to the first unread post", () => {
    renderTable([thread("t1", { unread: true }), thread("t2", { unread: false })]);
    const unread = within(rowOf(/Thread t1/));
    expect(unread.getByText("Unread")).toBeInTheDocument();
    const title = unread.getByRole("link", { name: "Thread t1" });
    expect(title).toHaveAttribute("href", "/thinkpages/t/t1/unread");
    expect(title).toHaveClass("font-semibold");
    const dot = unread.getByText("Unread").previousElementSibling as HTMLElement;
    expect(dot).toHaveClass("bg-tint", "rounded-full");
    expect(title.compareDocumentPosition(dot) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    const read = within(rowOf(/Thread t2/));
    expect(read.queryByText("Unread")).toBeNull();
    expect(read.getByRole("link", { name: "Thread t2" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t2"
    );
    expect(read.getByRole("link", { name: "Thread t2" })).not.toHaveClass("font-semibold");
    expect(read.getByRole("link", { name: "Thread t2" })).toHaveClass("font-medium");
  });
});
