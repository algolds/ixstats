import React from "react";
import { render, screen, within } from "@testing-library/react";

// Radix Avatar renders an image only once the browser has loaded it; show it at once.
jest.mock("~/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <span data-slot="avatar">{children}</span>
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
    pa: { displayName: "Aria Vance", username: "aria", avatarUrl: "/avatars/aria.png" },
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

  it("marks the active column with aria-sort and no other", () => {
    const { unmount } = renderTable([thread("t1")], "latest");
    const sorts = () => screen.getAllByRole("columnheader").map((h) => h.getAttribute("aria-sort"));
    expect(sorts()).toEqual([null, null, "descending"]);
    unmount();

    renderTable([thread("t1")], "replies");
    expect(sorts()).toEqual([null, "descending", null]);
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

  it("groups pinned threads first under a Pinned subheading, and only then", () => {
    const { unmount } = renderTable([thread("p1", { pinned: true }), thread("t1")]);
    const rows = screen.getAllByRole("row").map((r) => r.textContent ?? "");
    const pinned = rows.findIndex((r) => r.startsWith("Pinned"));
    expect(pinned).toBeGreaterThan(-1);
    expect(rows.findIndex((r) => r.includes("Thread p1"))).toBeGreaterThan(pinned);
    expect(rows.findIndex((r) => r.includes("Thread t1"))).toBeGreaterThan(
      rows.findIndex((r) => r.includes("Thread p1"))
    );
    unmount();

    renderTable([thread("t1")]);
    expect(screen.queryByRole("rowheader", { name: "Pinned" })).toBeNull();
  });

  it("shows a lock for locked threads, Imported only for imported ones and Hidden only when flagged", () => {
    renderTable([thread("a", { locked: true, xenforoThreadId: 7, hidden: true }), thread("b")]);
    const a = rowOf(/Thread a/);
    expect(within(a).getByLabelText("Locked")).toBeInTheDocument();
    expect(within(a).getByText("Imported")).toBeInTheDocument();
    expect(within(a).getByText("Hidden")).toBeInTheDocument();
    const b = rowOf(/Thread b/);
    expect(within(b).queryByLabelText("Locked")).toBeNull();
    expect(within(b).queryByText("Imported")).toBeNull();
    expect(within(b).queryByText("Hidden")).toBeNull();
  });

  it("names the persona, with its avatar and no flag, never the player behind it", () => {
    renderTable([thread("t1", { authorUserId: "u2", authorPersonaId: "pa" })]);
    const row = rowOf(/Thread t1/);
    expect(within(row).getByText("Aria Vance")).toBeInTheDocument();
    expect(within(row).queryByText("Hidden Player")).toBeNull();
    expect(row.querySelector('img[src="/flags/hidden.png"]')).toBeNull();
    expect(row.querySelector('img[src="/avatars/aria.png"]')).not.toBeNull();
  });

  it("shows a member's flag beside the starter, and the imported name for an imported author", () => {
    const { unmount } = renderTable([thread("t1")]);
    const row = rowOf(/Thread t1/);
    expect(within(row).getByText("Kir")).toBeInTheDocument();
    expect(row.querySelector('img[src="/flags/kir.png"]')).not.toBeNull();
    unmount();

    renderTable([thread("t2", { authorUserId: null, importedAuthorName: "OldName" })]);
    expect(within(rowOf(/Thread t2/)).getByText("OldName")).toBeInTheDocument();
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

  it("windows a long thread as 1 2 … 9", () => {
    renderTable([thread("t1", { postCount: 180 })]);
    const row = rowOf(/Thread t1/);
    const pages = within(row)
      .getAllByRole("link")
      .map((l) => l.textContent)
      .filter((t) => /^\d+$/.test(t ?? ""));
    expect(pages).toEqual(["1", "2", "9"]);
    expect(within(row).getByText("…")).toBeInTheDocument();
  });

  it("offers Last page on phones, and no shortcuts, for a one-page thread", () => {
    const { unmount } = renderTable([thread("t1", { postCount: 45 })]);
    expect(
      within(rowOf(/Thread t1/)).getByRole("link", { name: "Last page of Thread t1" })
    ).toHaveAttribute("href", "/thinkpages/t/t1?page=3");
    unmount();

    renderTable([thread("t1", { postCount: 5 })]);
    const row = rowOf(/Thread t1/);
    expect(within(row).queryByRole("link", { name: "Page 2 of Thread t1" })).toBeNull();
    expect(within(row).queryByRole("link", { name: "Last page of Thread t1" })).toBeNull();
  });
});
