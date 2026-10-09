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

  it("says what was searched when nothing was found, and when a category is empty", () => {
    const { rerender } = render(<CommonsResultsGrid {...base} />);
    expect(screen.getByText("No images found for “castle”")).toBeInTheDocument();
    rerender(<CommonsResultsGrid {...base} mode="browse" query="" />);
    expect(screen.getByText("This category has no images.")).toBeInTheDocument();
    rerender(<CommonsResultsGrid {...base} mode="idle" query="" />);
    expect(screen.getByText("Explore images")).toBeInTheDocument();
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

  it("counts what is shown and what the filters hide", () => {
    render(<CommonsResultsGrid {...base} images={[image(1)]} totalHits={120} loadedCount={4} />);
    expect(screen.getByText("Showing 1 of 120 (3 hidden by filters)")).toBeInTheDocument();
  });

  it("says when a wiki result hit its cap", () => {
    render(<CommonsResultsGrid {...base} images={[image(1)]} truncated />);
    expect(screen.getByText("Showing the first 50 files")).toBeInTheDocument();
  });

  it("shows the cold start, not the filter message, when a filter is set before any search", () => {
    render(<CommonsResultsGrid {...base} mode="idle" query="" isFilterActive />);
    expect(screen.getByText("Explore images")).toBeInTheDocument();
    expect(screen.queryByText("No matching images found")).not.toBeInTheDocument();
  });

  it("shows a failure and the loading skeleton ahead of the filter message", () => {
    const { rerender, container } = render(
      <CommonsResultsGrid {...base} isFilterActive error={{ rateLimited: false }} />
    );
    expect(screen.getByText("Search failed")).toBeInTheDocument();
    expect(screen.queryByText("No matching images found")).not.toBeInTheDocument();

    rerender(<CommonsResultsGrid {...base} isFilterActive isLoading />);
    expect(screen.queryByText("No matching images found")).not.toBeInTheDocument();
    expect(container.querySelector(".wikios-commons-grid")).not.toBeNull();
  });

  it("says a wiki with nothing to list has no images, not that a category is empty", () => {
    render(<CommonsResultsGrid {...base} mode="list" query="" />);
    expect(screen.getByText("This wiki has no images to list.")).toBeInTheDocument();
    expect(screen.queryByText("This category has no images.")).not.toBeInTheDocument();
  });

  it("labels unknown dimensions Vector only for an SVG, and otherwise shows nothing", () => {
    const svg = { ...image(1), width: 0, height: 0, mime: "image/svg+xml" };
    const raster = { ...image(2), width: 0, height: 0, mime: "image/png" };
    const sized = image(3);
    render(<CommonsResultsGrid {...base} images={[svg, raster, sized]} />);
    expect(screen.getAllByText("Vector")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Castle 1.jpg" })).toHaveTextContent("Vector");
    expect(screen.getByRole("button", { name: "Castle 2.jpg" })).not.toHaveTextContent("Vector");
    expect(screen.getByRole("button", { name: "Castle 3.jpg" })).toHaveTextContent("1200×800");
  });
});
