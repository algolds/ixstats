import React from "react";
import { render } from "@testing-library/react";

// Surface motion's layoutId in the DOM: shared layoutIds make the active-row pill glide between
// separate lists, which the rail's per-app popovers must not do.
jest.mock("motion/react", () => ({
  motion: {
    span: ({ layoutId }: { layoutId?: string }) => <span data-layout-id={layoutId} />,
  },
}));

import { SourceList } from "~/components/shell/SourceList";
import { getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({ signedIn: true, isAdmin: false });

describe("SourceList active indicator ids", () => {
  it("gives each rail popover its own layoutId", () => {
    const ids = ["vault", "mycountry"].map((id) => {
      const app = apps.find((a) => a.id === id)!;
      const { container, unmount } = render(
        <SourceList
          variant="popover"
          app={app}
          pathname={app.sections[0]!.href}
          searchParams={null}
          apps={apps}
          expanded={new Set()}
          onToggle={() => {}}
          badges={{}}
        />
      );
      const layoutId = container.querySelector("[data-layout-id]")?.getAttribute("data-layout-id");
      unmount();
      return layoutId;
    });
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });
});
