/**
 * CommonsResultsGrid: a failed search is not "Explore images" (it offers a retry), an empty filtered page still offers
 * "Load more", images are identified by url, and the cards are toggle buttons.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CommonsResultsGrid } from "~/components/wiki-os/commons/CommonsResultsGrid";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

const image = (n: number): CommonsImage => ({
  pageid: 0,
  title: `File:Castle ${n}.jpg`,
  thumbUrl: `https://upload.example/thumb/${n}.jpg`,
  url: `https://upload.example/${n}.jpg`,
  descriptionUrl: "",
  width: 1200,
  height: 800,
  mime: "image/jpeg",
  description: "",
  artist: "",
  license: "",
});

const base = {
  images: [] as CommonsImage[],
  selectedImage: null,
  onSelect: jest.fn(),
  hasMore: false,
  isLoading: false,
  mode: "search" as const,
  query: "castle",
};

describe("CommonsResultsGrid", () => {
  it("shows a failure with a retry, and says so when the search bucket is spent", () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      <CommonsResultsGrid {...base} error={{ rateLimited: false }} onRetry={onRetry} />
    );
    expect(screen.getByText("Could not reach the image source.")).toBeInTheDocument();
    expect(screen.queryByText("Explore images")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<CommonsResultsGrid {...base} error={{ rateLimited: true }} onRetry={onRetry} />);
    expect(screen.getByText("Too many searches. Wait a minute and retry.")).toBeInTheDocument();
  });

  it("still offers Load more when the filters hide everything loaded so far", () => {
    const onLoadMore = jest.fn();
    render(
      <CommonsResultsGrid
        {...base}
        hasMore
        onLoadMore={onLoadMore}
        isFilterActive
        loadedCount={40}
      />
    );
    expect(screen.getByText("No matching images found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more images" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
  it("exposes each card as a toggle button identified by url, and confirms on double-click", () => {
    const onSelect = jest.fn();
    const onConfirm = jest.fn();
    const one = image(1);
    const two = image(2);
    render(
      <CommonsResultsGrid
        {...base}
        images={[one, two]}
        selectedImage={{ ...two, pageid: 99 }}
        onSelect={onSelect}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole("button", { name: "Castle 1.jpg" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Castle 2.jpg" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Castle 1.jpg" }));
    expect(onSelect).toHaveBeenCalledWith(one);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Castle 1.jpg" }));
    expect(onConfirm).toHaveBeenCalledWith(one);
  });
});
