import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ thinkpagesForumMod: { invalidate: () => Promise.resolve() } }),
    thinkpagesForumMod: {
      context: { useQuery: () => ({ data: undefined }) },
      setPostHidden: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
    },
  },
}));

// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <button type="button" role="menuitem">
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { ModeratorMenuItems } from "~/components/thinkpages-forum/ModeratorMenu";
import type { ForumPost } from "~/components/thinkpages-forum/thread/types";

const postBy = (authorUserId: string | null): ForumPost => ({
  id: "p1",
  authorUserId,
  authorPersonaId: null,
  importedAuthorName: authorUserId ? null : "OldName",
  contentHtml: "<p>x</p>",
  editedAt: null,
  createdAt: new Date(),
  number: 1,
  role: null,
  byViewer: false,
  isOwn: false,
  hidden: false,
  moderable: true,
  sanctionable: true,
});

describe("ModeratorMenuItems on imported content", () => {
  it("offers Warn and Ban only on a post with an IxStats author, whatever the flags say", () => {
    const { rerender } = render(
      <ModeratorMenuItems post={postBy("u2")} onOpen={jest.fn()} onEdit={jest.fn()} />
    );
    expect(screen.getByRole("menuitem", { name: "Warn author" })).toBeInTheDocument();
    rerender(<ModeratorMenuItems post={postBy(null)} onOpen={jest.fn()} onEdit={jest.fn()} />);
    expect(screen.getByRole("menuitem", { name: "Hide post" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Warn author" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Ban author" })).toBeNull();
  });
});
