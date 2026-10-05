/**
 * VT-12: forum authors' equipped chat badges show to every reader (they used to show only on
 * the viewer's own posts), and a page of authors costs one public-cosmetics request.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

const cosmeticsQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    vault: {
      getEquippedCosmeticsFor: { useQuery: (...args: unknown[]) => cosmeticsQuery(...args) },
    },
  },
}));

import { ThreadListItem } from "~/components/forum/reader/ThreadListItem";
import { useForumAuthorCosmetics } from "~/hooks/usePublicCosmetics";
import { noPublicCosmetics } from "~/lib/vault/public-cosmetics";

const badge = { enabled: true, icon: "Crown", color: "#f59e0b" };

const thread = {
  threadId: 1,
  title: "Budget talks",
  authorId: 42,
  authorName: "Ada",
  authorAvatar: null,
  postDate: 0,
  replyCount: 0,
  viewCount: 0,
  lastPostDate: 0,
  lastPostUsername: "Bo",
  isSticky: false,
  isOpen: true,
};

describe("forum author cosmetics", () => {
  beforeEach(() => cosmeticsQuery.mockReset());

  it("shows another author's equipped badge", () => {
    const { container } = render(<ThreadListItem {...thread} authorBadge={badge} />);
    const icon = container.querySelector("svg[aria-hidden]") as SVGElement | null;
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(2); // replies, views, badge
    expect(icon?.getAttribute("style")).toContain("color");
  });

  it("shows no badge when the author has none equipped", () => {
    const withBadge = render(<ThreadListItem {...thread} authorBadge={badge} />);
    const withBadgeIcons = withBadge.container.querySelectorAll("svg").length;
    withBadge.unmount();
    const { container } = render(<ThreadListItem {...thread} authorBadge={null} />);
    expect(container.querySelectorAll("svg").length).toBe(withBadgeIcons - 1);
  });

  it("looks a page of authors up in one request, deduplicated and keyed by forum id", () => {
    const cosmetics = {
      ...noPublicCosmetics(),
      equipped: ["cosmetic_chat_badge"],
      chatBadge: badge,
    };
    cosmeticsQuery.mockReturnValue({ data: { users: {}, forumUsers: { "42": cosmetics } } });

    let lookup: ReturnType<typeof useForumAuthorCosmetics> = () => null;
    function Probe() {
      lookup = useForumAuthorCosmetics([42, 7, 42, undefined]);
      return null;
    }
    render(<Probe />);

    expect(cosmeticsQuery).toHaveBeenCalledTimes(1);
    expect(cosmeticsQuery.mock.calls[0][0]).toEqual({ forumUserIds: [42, 7] });
    expect(lookup(42)?.chatBadge.enabled).toBe(true);
    expect(lookup(7)).toBeNull();
    expect(lookup(undefined)).toBeNull();
  });
});
