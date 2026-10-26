/**
 * C1c (plan 2026-10-25 sister wikis, Task 8): the media search detail panel and a stashed image's sheet offer only
 * the formats their file allows and start on the first, whichever image was open before; what they copy for a sister
 * wiki file is a link.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    wikios: { stashPage: { useMutation: () => ({ mutate: jest.fn() }) } },
  },
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { StashImagesGrid } from "~/components/wiki-os/stashes/StashImagesGrid";
import { imageFromUrl, type CommonsImage } from "~/components/wiki-os/media-search/types";

const file = (key: string, descriptionUrl: string): [string, CommonsImage] => [
  key,
  {
    ...imageFromUrl(`/api/mediawiki/x/${key}.png`),
    title: `File:${key}.png`,
    descriptionUrl,
    width: 10,
    height: 10,
    mime: "image/png",
  },
];

const IIWIKI_PAGE = "https://iiwiki.com/wiki/File:Avalon.png";
const images = new Map([
  file("Avalon", IIWIKI_PAGE),
  file("Earth", "https://commons.wikimedia.org/wiki/File:Earth.png"),
]);
const items = [...images.keys()].map((pageTitle) => ({ id: pageTitle, pageTitle }));

const writeText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
// Regular width: the panel is the inline rail, not a sheet.
window.matchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: true,
  media: query,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

const open = (name: string) => fireEvent.click(screen.getAllByAltText(name)[0]!);
const formats = () => screen.getAllByRole("radio").map((radio) => radio.textContent);
const checked = () => screen.getByRole("radio", { checked: true }).textContent;

describe("a stashed image's copy formats", () => {
  it("a sister wiki file starts on Link and copies a link; the next image starts on its own first format", async () => {
    render(<StashImagesGrid items={items} resolvedImagesMap={images} onUnstash={jest.fn()} />);

    open("Avalon");
    expect(formats()).toEqual(["Link", "URL"]);
    expect(checked()).toBe("Link");
    fireEvent.click(screen.getByRole("button", { name: "Copy wikitext" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`[${IIWIKI_PAGE} Avalon.png]`));

    fireEvent.click(screen.getByRole("radio", { name: "URL" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());

    open("Earth");
    expect(formats()).toEqual(["Thumb", "Embed", "File", "URL"]);
    expect(checked()).toBe("Thumb");
  });
});

describe("the media search detail panel's copy formats", () => {
  it("starts on the first format the shown image allows, and copies a link for a sister wiki file", async () => {
    const { rerender } = render(
      <CommonsDetailPanel image={images.get("Earth")!} onClose={jest.fn()} />
    );
    expect(checked()).toBe("Thumb");
    fireEvent.click(screen.getByRole("radio", { name: "URL" }));
    expect(checked()).toBe("URL");

    rerender(<CommonsDetailPanel image={images.get("Avalon")!} onClose={jest.fn()} />);
    expect(formats()).toEqual(["Link", "URL"]);
    expect(checked()).toBe("Link");
    fireEvent.click(screen.getByRole("button", { name: "Copy wikitext" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`[${IIWIKI_PAGE} Avalon.png]`));
  });
});
