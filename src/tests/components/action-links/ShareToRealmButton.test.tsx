import React from "react";
import { render, screen } from "@testing-library/react";

const flags = jest.fn();
jest.mock("~/components/shell/use-forum-nav-flags", () => ({
  useForumNavFlags: (signedIn: boolean) => flags(signedIn),
}));
// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div role="menuitem">{children}</div>
  ),
}));

import { ShareToRealmButton } from "~/components/action-links/ShareToRealmButton";

interface FakeRealm {
  slug: string;
  name: string;
  emblemUrl: string | null;
  thumbnail: string | null;
}

const realm: FakeRealm = { slug: "eurth", name: "Eurth", emblemUrl: null, thumbnail: null };
const withRealm = (r: FakeRealm | null) =>
  flags.mockReturnValue({ realmMember: r !== null, forumModerator: false, realm: r });

describe("ShareToRealmButton", () => {
  beforeEach(() => flags.mockReset());

  it("renders nothing when the viewer's nation is in no realm", () => {
    withRealm(null);
    const { container } = render(<ShareToRealmButton activityId="dir-abc" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks as a signed-in viewer", () => {
    withRealm(realm);
    render(<ShareToRealmButton activityId="dir-abc" />);
    expect(flags).toHaveBeenCalledWith(true);
  });

  it("offers the realm's board and its Hub, each opening a composer prefilled with the action", () => {
    withRealm(realm);
    render(<ShareToRealmButton activityId="dir-abc" />);
    expect(screen.getByRole("button", { name: /Discuss in the forum/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post on the Eurth board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth?attach=dir-abc"
    );
    expect(screen.getByRole("link", { name: "Start a thread in Eurth Hub" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub/new?attach=dir-abc"
    );
  });

  it("encodes a slug with a space", () => {
    withRealm({ ...realm, slug: "new eurth", name: "New Eurth" });
    render(<ShareToRealmButton activityId="dir-abc" />);
    expect(screen.getByRole("link", { name: "Post on the New Eurth board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/new%20eurth?attach=dir-abc"
    );
  });
});
