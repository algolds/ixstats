import React from "react";
import { render, screen } from "@testing-library/react";

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

describe("ThreadTable rows", () => {
  it("shows titles as text, never markup", () => {
    renderTable([thread("t1", { title: "<i>Hi</i>" })]);
    expect(screen.getByText("<i>Hi</i>")).toBeInTheDocument();
  });
});
