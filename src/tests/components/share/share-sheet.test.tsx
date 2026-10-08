/**
 * The share sheet copies the canonical absolute link (never a query string), offers the native share
 * sheet only where the browser has one, downloads the page's OG image, and shows host extras only when given.
 */
import { describe, expect, it, beforeEach } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Radix popovers measure themselves; jsdom has no ResizeObserver.
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { ShareSheet } from "~/components/share/ShareSheet";

const writeText = jest.fn<Promise<void>, [string]>();

function open(props: Partial<React.ComponentProps<typeof ShareSheet>> = {}) {
  render(<ShareSheet path="/@alex" title="Alex" imagePath="/id/alex/opengraph-image" {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  Reflect.deleteProperty(navigator, "share");
});

describe("ShareSheet", () => {
  it("copies the canonical absolute link without a query string", async () => {
    open({ path: "/@alex?tab=collection" });
    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/@alex`));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("hides the native Share item when navigator.share is missing", async () => {
    open();
    await screen.findByRole("button", { name: "Copy link" });
    expect(screen.queryByRole("button", { name: "Share to other apps" })).toBeNull();
  });

  it("shows the native Share item and hands it the canonical URL when navigator.share exists", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Share to other apps" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ title: "Alex", url: `${window.location.origin}/@alex` })
    );
  });

  it("downloads the page's card image", async () => {
    open({ downloadName: "card.png" });
    const link = await screen.findByRole("link", { name: "Download card" });
    expect(link.getAttribute("href")).toBe("/id/alex/opengraph-image");
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("omits Download card without an image", async () => {
    open({ imagePath: undefined });
    await screen.findByRole("button", { name: "Copy link" });
    expect(screen.queryByRole("link", { name: "Download card" })).toBeNull();
  });

  it("shows host extras only when provided, and copies their full URL", async () => {
    const { unmount } = render(<ShareSheet path="/r/eurth" title="Eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByRole("button", { name: "Copy link" });
    expect(screen.queryByRole("button", { name: "Copy invite link" })).toBeNull();
    unmount();

    render(
      <ShareSheet
        path="/r/eurth"
        title="Eurth"
        extraLinks={[{ label: "Copy invite link", path: "/r/eurth?via=alex" }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy invite link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/r/eurth?via=alex`)
    );
  });
});
