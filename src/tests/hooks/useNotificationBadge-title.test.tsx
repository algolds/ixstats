/**
 * The unread "(N)" title prefix must be applied to whichever page title is current,
 * never to a title captured from an earlier page.
 */
import { act, render } from "@testing-library/react";

let unread = 0;
jest.mock("~/trpc/react", () => ({
  api: {
    notifications: {
      getUnreadCount: { useQuery: () => ({ data: { count: unread } }) },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" } }),
}));

import { useNotificationBadge } from "~/hooks/useLiveNotifications";
import { usePageTitle } from "~/hooks/usePageTitle";

/** Mounted for the whole session, like GameSidecar. */
function Sidecar() {
  useNotificationBadge({ enableTitleBadge: true });
  return null;
}

function Page({ title }: { title: string }) {
  usePageTitle({ title });
  return null;
}

function App({ page }: { page: string | null }) {
  return (
    <>
      {page ? <Page key={page} title={page} /> : null}
      {/* After the page, like GameSidecar: its effect runs last and wins the title. */}
      <Sidecar />
    </>
  );
}

describe("useNotificationBadge title handling", () => {
  beforeEach(() => {
    unread = 0;
    document.title = "";
  });

  it("prefixes the current page title after navigating between pages", () => {
    const view = render(<App page="First" />);
    expect(document.title).toBe("First - IxStats");

    view.rerender(<App page="Second" />);
    expect(document.title).toBe("Second - IxStats");

    unread = 4;
    view.rerender(<App page="Second" />);
    expect(document.title).toBe("(4) Second - IxStats");

    unread = 0;
    view.rerender(<App page="Second" />);
    expect(document.title).toBe("Second - IxStats");
  });

  it("does not revert to the first page title when the sidecar updates or unmounts", () => {
    const view = render(<App page="First" />);
    view.rerender(<App page="Second" />);

    unread = 2;
    act(() => {
      view.rerender(<App page="Second" />);
    });
    expect(document.title).toBe("(2) Second - IxStats");

    view.rerender(<App page={null} />);
    // Sidecar still mounted; with no page mounted the title stays clean of stale "First".
    expect(document.title).not.toContain("First");

    view.unmount();
    expect(document.title).not.toContain("First");
  });

  it("strips the prefix on unmount without touching the rest of the title", () => {
    function Solo() {
      useNotificationBadge({ enableTitleBadge: true });
      return null;
    }
    document.title = "Plain page";
    unread = 3;
    const view = render(<Solo />);
    expect(document.title).toBe("(3) Plain page");
    view.unmount();
    expect(document.title).toBe("Plain page");
  });
});
