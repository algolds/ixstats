/**
 * The image detail panel starts fresh for each image, reports clipboard results honestly, previews a sized
 * image, and leaves Escape to the picker dialog when it sits inside one.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommonsDetailPanel, previewSrc } from "~/components/wiki-os/commons/CommonsDetailPanel";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface FakeMutation {
  mutate: jest.Mock;
  isPending: boolean;
  isSuccess: boolean;
}

const mockNotify = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  notify: jest.fn(),
};
let stashMutation: FakeMutation;

jest.mock("~/trpc/react", () => ({
  api: { wikios: { stashPage: { useMutation: () => stashMutation } } },
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "user-1" } }) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

const image = (name: string, over: Partial<CommonsImage> = {}): CommonsImage => ({
  pageid: 1,
  title: `File:${name}.jpg`,
  thumbUrl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/300px-${name}.jpg`,
  url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}.jpg`,
  descriptionUrl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
  width: 1200,
  height: 800,
  mime: "image/jpeg",
  description: "",
  artist: "",
  license: "",
  ...over,
});

function mockRegularWidth(matches: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  stashMutation = { mutate: jest.fn(), isPending: false, isSuccess: false };
  mockRegularWidth(true);
});

describe("previewSrc", () => {
  it("requests a Commons thumb at 960px", () => {
    expect(previewSrc(image("Harbour"))).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Harbour.jpg/960px-Harbour.jpg"
    );
  });

  it("rewrites a thumb.wikimedia.org thumb and drops its utm query", () => {
    const thumb =
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Schloss_Neuschwanstein_2013.jpg/330px-Schloss_Neuschwanstein_2013.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail";
    expect(previewSrc(image("Schloss", { thumbUrl: thumb }))).toBe(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Schloss_Neuschwanstein_2013.jpg/960px-Schloss_Neuschwanstein_2013.jpg"
    );
  });

  it("uses a non-Commons thumb as given", () => {
    const local = image("Local", { thumbUrl: "/api/mediawiki/ixwiki/images/a/ab/Local.jpg" });
    expect(previewSrc(local)).toBe("/api/mediawiki/ixwiki/images/a/ab/Local.jpg");
  });

  it("falls back to the original when there is no thumb", () => {
    const bare = image("Bare", { thumbUrl: "" });
    expect(previewSrc(bare)).toBe(bare.url);
  });
});

describe("CommonsDetailPanel", () => {
  it("re-enables the stash button when another image is shown", () => {
    stashMutation.isSuccess = true;
    const { rerender } = render(<CommonsDetailPanel image={image("A")} onClose={jest.fn()} />);
    const getStash = () => screen.getAllByRole("button", { name: "Stash to library" })[0]!;
    expect(getStash()).toBeDisabled();

    // The next image mounts a fresh panel and a fresh mutation.
    stashMutation = { mutate: jest.fn(), isPending: false, isSuccess: false };
    rerender(<CommonsDetailPanel image={image("B")} onClose={jest.fn()} />);
    expect(getStash()).toBeEnabled();
  });

  it("shows an error and no check mark when the clipboard write fails", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<CommonsDetailPanel image={image("A")} onClose={jest.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: /Copy wikitext/ })[0]!);

    await waitFor(() =>
      expect(mockNotify.error).toHaveBeenCalledWith(
        "Could not copy",
        "Your browser blocked clipboard access."
      )
    );
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("hides the dimensions row when the size is unknown", () => {
    render(<CommonsDetailPanel image={image("A", { width: 0, height: 0 })} onClose={jest.fn()} />);
    expect(screen.queryByText("Dimensions")).not.toBeInTheDocument();
  });

  it("falls back to the original once, then reports the preview unavailable", () => {
    render(<CommonsDetailPanel image={image("A")} onClose={jest.fn()} />);
    const preview = () => screen.getAllByRole("img", { name: "A.jpg" })[0]!;
    expect(preview().getAttribute("src")).toContain("960px-A.jpg");

    fireEvent.error(preview());
    expect(preview().getAttribute("src")).toBe(image("A").url);

    fireEvent.error(preview());
    expect(screen.getAllByText("Preview unavailable").length).toBeGreaterThan(0);
  });

  it("closes on Escape outside a dialog", () => {
    const onClose = jest.fn();
    render(<CommonsDetailPanel image={image("A")} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to the dialog when rendered inside one", () => {
    const onClose = jest.fn();
    render(
      <div role="dialog">
        <CommonsDetailPanel image={image("A")} onClose={onClose} />
      </div>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
