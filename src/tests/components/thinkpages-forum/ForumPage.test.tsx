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
      <ForumPage title="General" breadcrumbs={<span>Trail</span>} actions={<button>New thread</button>}>
        <p>Body</p>
      </ForumPage>
    );
    expect(screen.getByRole("heading", { level: 1, name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Trail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New thread" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
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
    expect(container.querySelector('[data-slot="inspector"]')).toHaveAttribute("aria-label", "Board info");
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

  it("renders nothing without children", () => {
    const { container } = render(<RailPanel title="Empty" icon={<Folder />}>{[]}</RailPanel>);
    expect(container).toBeEmptyDOMElement();
  });
});
