/**
 * The picker's My stash tab shows images stashed from Commons as well as IxWiki pages, reaches stash folders
 * by keyboard, and shows an error with a retry instead of a spinner that never ends.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MyStashTab } from "~/components/wiki-os/media-search/MyStashTab";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface QueryResult<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
}

const ok = <T,>(data: T): QueryResult<T> => ({
  data,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
});

let stashItems: QueryResult<{ items: Array<{ pageTitle: string }> }>;
let commonsImages: QueryResult<CommonsImage[]>;
let pageImages: (title: string) => QueryResult<unknown[]>;

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getStashes: {
        useQuery: () => ok([{ id: "s1", name: "Harbours", color: "#336699", itemCount: 2 }]),
      },
      getStashItems: { useQuery: () => stashItems },
    },
    commons: { getImageInfoByTitles: { useQuery: () => commonsImages } },
    useQueries: (
      build: (t: {
        wikios: { getPageImages: (input: { title: string }) => { title: string } };
      }) => Array<{ title: string }>
    ) =>
      build({ wikios: { getPageImages: (input) => ({ title: input.title }) } }).map((q) =>
        pageImages(q.title)
      ),
  },
}));
jest.mock("~/components/wiki-os/commons/CommonsDetailPanel", () => ({
  CommonsDetailPanel: () => null,
}));

const commonsImage: CommonsImage = {
  pageid: 77,
  title: "File:A.jpg",
  thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/300px-A.jpg",
  url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg",
  descriptionUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
  width: 1200,
  height: 800,
  mime: "image/jpeg",
  description: "",
  artist: "Jane Doe",
  license: "CC BY-SA 4.0",
};

function openStash() {
  render(
    <MyStashTab
      selectedImageObj={null}
      onSelectImage={jest.fn()}
      onDoubleClickConfirm={jest.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: /Harbours/ }));
}

beforeEach(() => {
  stashItems = ok({ items: [{ pageTitle: "commons:File:A.jpg" }, { pageTitle: "Some page" }] });
  commonsImages = ok([commonsImage]);
  pageImages = () =>
    ok([
      {
        title: "File:B.png",
        url: "/api/mediawiki/ixwiki/images/b/b0/B.png",
        thumbUrl: "/api/mediawiki/ixwiki/images/thumb/b/b0/B.png/300px-B.png",
        width: 640,
        height: 480,
      },
    ]);
});

describe("MyStashTab", () => {
  it("lists stash folders as buttons", () => {
    render(
      <MyStashTab
        selectedImageObj={null}
        onSelectImage={jest.fn()}
        onDoubleClickConfirm={jest.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Harbours/ })).toBeInTheDocument();
  });

  it("shows both a stashed Commons image and an image from a stashed IxWiki page", () => {
    openStash();

    expect(screen.getByRole("img", { name: "A.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "B.png" })).toBeInTheDocument();
  });

  it("shows an error with a retry rather than a spinner when a lookup fails", () => {
    commonsImages = { isLoading: false, isError: true, refetch: jest.fn() };
    openStash();

    expect(screen.getByText("Could not load this stash.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(commonsImages.refetch).toHaveBeenCalledTimes(1);
  });
});
