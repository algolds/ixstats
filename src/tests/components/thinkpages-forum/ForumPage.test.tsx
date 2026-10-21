import "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ForumPage } from "~/components/thinkpages-forum/shell";

const originalMatchMedia = window.matchMedia;

function installViewport(wide: boolean, phone = false) {
  window.matchMedia = ((query: string) => ({
    matches:
      query === "(min-width: 1280px)" ? wide : query === "(max-width: 767px)" ? phone : false,
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
