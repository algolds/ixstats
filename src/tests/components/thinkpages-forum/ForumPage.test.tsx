import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Folder } from "iconoir-react";

import { ForumPage, RailPanel } from "~/components/thinkpages-forum/shell";

const originalMatchMedia = window.matchMedia;

function installViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query === "(min-width: 1280px)" ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("ForumPage", () => {
  it("renders the title, breadcrumbs, actions and body", () => {
    installViewport(true);
    render(
      <ForumPage
        title="General"
        breadcrumbs={<span>Trail</span>}
        actions={<button>New thread</button>}
      >
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.getByRole("heading", { level: 1, name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Trail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New thread" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("pads the page column wherever the bleeding header would reach the viewport edge", () => {
    installViewport(true);
    const { container } = render(
      <ForumPage title="General" rail={<p>Rail content</p>}>
        <p>Body</p>
      </ForumPage>
    );
    const header = container.querySelector('[data-slot="page-header"]')!;
    // PageHeader's bleed (-mx-2) needs padding on its parent below xl; from xl the shell gutters take over.
    expect(header).toHaveClass("-mx-2");
    expect(header.parentElement).toHaveClass("px-4", "xl:px-0");
    expect(screen.getByText("Body").parentElement?.parentElement).toBe(header.parentElement);
  });

  it("keeps the padding at xl and wider when there is no rail, or the bleed overflows by 8px", () => {
    installViewport(true);
    const { container } = render(
      <ForumPage title="Moderation">
        <p>Body</p>
      </ForumPage>
    );
    const column = container.querySelector('[data-slot="page-header"]')!.parentElement!;
    expect(column).toHaveClass("px-4");
    expect(column).not.toHaveClass("xl:px-0");
  });

  it("has no inspector and no Info button without a rail", () => {
    installViewport(true);
    const { container } = render(
      <ForumPage title="General">
        <p>Body</p>
      </ForumPage>
    );
    expect(container.querySelector('[data-slot="inspector"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Info" })).toBeNull();
  });

  it("puts the rail in the inspector, titled Info by default", () => {
    installViewport(true);
    const { container } = render(
      <ForumPage title="General" rail={<p>Rail content</p>}>
        <p>Body</p>
      </ForumPage>
    );
    const inspector = container.querySelector('[data-slot="inspector"]');
    expect(inspector).not.toBeNull();
    expect(inspector).toHaveAttribute("aria-label", "Info");
    expect(inspector).toHaveTextContent("Rail content");
  });

  it("titles the inspector with railTitle", () => {
    installViewport(true);
    const { container } = render(
      <ForumPage title="General" rail={<p>Rail</p>} railTitle="Board info">
        <p>Body</p>
      </ForumPage>
    );
    expect(container.querySelector('[data-slot="inspector"]')).toHaveAttribute(
      "aria-label",
      "Board info"
    );
  });

  it("opens the rail as a sheet from the header Info button on a narrow viewport", () => {
    installViewport(false);
    render(
      <ForumPage title="General" rail={<p>Rail content</p>}>
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.queryByText("Rail content")).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Info" }));
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("Rail content");
  });

  it("marks the Info button as a dialog opener and reflects the open sheet", () => {
    installViewport(false);
    render(
      <ForumPage title="General" rail={<p>Rail content</p>}>
        <p>Body</p>
      </ForumPage>
    );
    const info = screen.getByRole("button", { name: "Info" });
    expect(info).toHaveAttribute("aria-haspopup", "dialog");
    expect(info).toHaveAttribute("aria-expanded", "false");
    act(() => {
      fireEvent.click(info);
    });
    expect(info).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ForumPage back link and rail hash", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("passes the header's back link through", () => {
    installViewport(true);
    render(
      <ForumPage title="Hub" back={{ href: "/thinkpages", label: "ThinkPages" }}>
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.getByRole("link", { name: "ThinkPages" })).toHaveAttribute("href", "/thinkpages");
  });

  it("opens the rail sheet on a narrow viewport when the URL carries the hash", () => {
    installViewport(false);
    window.location.hash = "#standing";
    render(
      <ForumPage title="Home" rail={<p>Rail content</p>} openRailOnHash="#standing">
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Rail content");
  });

  it("opens the sheet once the rail appears, and not for another hash or a wide viewport", () => {
    installViewport(false);
    window.location.hash = "#standing";
    const { rerender, unmount } = render(
      <ForumPage title="Home" openRailOnHash="#standing">
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <ForumPage title="Home" rail={<p>Rail content</p>} openRailOnHash="#standing">
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();

    window.location.hash = "#other";
    const other = render(
      <ForumPage title="Home" rail={<p>Rail content</p>} openRailOnHash="#standing">
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    other.unmount();

    installViewport(true);
    window.location.hash = "#standing";
    render(
      <ForumPage title="Home" rail={<p>Rail content</p>} openRailOnHash="#standing">
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("RailPanel", () => {
  it("is a data pane with an icon title and its content", () => {
    const { container } = render(
      <RailPanel title="Board rules" icon={<Folder />}>
        <p>Be kind</p>
      </RailPanel>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Board rules" })).toBeInTheDocument();
    expect(screen.getByText("Be kind")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toHaveAttribute("data-content", "data");
  });

  it("is a pane in the desktop aside and a well inside the narrow sheet, so glass never sits on glass", () => {
    installViewport(true);
    const wide = render(
      <ForumPage
        title="Home"
        rail={
          <RailPanel title="Standing" icon={<Folder />}>
            <p>Points</p>
          </RailPanel>
        }
      >
        <p>Body</p>
      </ForumPage>
    );
    expect(
      wide.container.querySelector('[data-slot="inspector"] [data-slot="card"]')
    ).toHaveAttribute("data-variant", "pane");
    wide.unmount();

    installViewport(false);
    render(
      <ForumPage
        title="Home"
        rail={
          <RailPanel title="Standing" icon={<Folder />}>
            <p>Points</p>
          </RailPanel>
        }
      >
        <p>Body</p>
      </ForumPage>
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Info" }));
    });
    const card = screen.getByRole("dialog").querySelector('[data-slot="card"]');
    expect(card).toHaveAttribute("data-variant", "well");
    expect(card).toHaveAttribute("data-content", "data");
  });

  it("renders nothing without children", () => {
    const { container } = render(
      <RailPanel title="Empty" icon={<Folder />}>
        {[]}
      </RailPanel>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
