/**
 * Plan 413 review: when getMainPage fails, the Main Page says so (with a retry) and its sections stop
 * being skeletons; while the answer is still coming they are skeletons.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { WikiOSMainPage } from "~/components/wiki-os/reader/WikiOSMainPage";

const mockRefetch = jest.fn();
let mockMain: { data?: unknown; error: { message: string } | null } = {
  data: undefined,
  error: null,
};
const mockContent = jest.fn();

jest.mock("motion/react", () => ({
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/trpc/react", () => {
  const idle = { data: undefined, error: null, refetch: jest.fn() };
  return {
    api: {
      wikios: {
        getMainPage: {
          useQuery: () => ({ ...mockMain, refetch: mockRefetch }),
        },
        getArticleAuthors: { useQuery: () => idle },
      },
      countries: { getSelectList: { useQuery: () => idle } },
      blurbs: {
        getResponsesForPrompt: {
          useInfiniteQuery: () => ({ data: undefined, fetchNextPage: jest.fn() }),
        },
      },
    },
  };
});
jest.mock("~/components/wiki-os/reader/hero", () => ({ WikiHeroMaster: () => <div>hero</div> }));
jest.mock("~/components/wiki-os/reader/main", () => ({
  EditorialMainPageContent: (props: { isLoadingRecent: boolean; isLoadingAlmanac: boolean }) => {
    mockContent(props);
    return <div>editorial</div>;
  },
  SculptedMainPageContent: (props: { isLoadingRecent: boolean; isLoadingAlmanac: boolean }) => {
    mockContent(props);
    return <div>sculpted</div>;
  },
}));

const lastProps = () =>
  mockContent.mock.calls.at(-1)![0] as {
    isLoadingRecent: boolean;
    isLoadingAlmanac: boolean;
  };

beforeEach(() => {
  jest.clearAllMocks();
  mockMain = { data: undefined, error: null };
});

describe("WikiOSMainPage when its data fails", () => {
  it("shows skeletons while the answer is on its way, with no error", () => {
    render(<WikiOSMainPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(lastProps()).toMatchObject({ isLoadingRecent: true, isLoadingAlmanac: true });
  });

  it("says it could not be loaded, offers a retry, and stops the skeletons", () => {
    mockMain = { data: undefined, error: { message: "Too many requests" } };
    render(<WikiOSMainPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("The Main Page could not be loaded");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests");
    expect(lastProps()).toMatchObject({ isLoadingRecent: false, isLoadingAlmanac: false });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps showing the page it has when a later refresh fails", () => {
    mockMain = { data: { categories: [], featured: null }, error: { message: "refresh failed" } };
    render(<WikiOSMainPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(lastProps()).toMatchObject({ isLoadingRecent: false });
  });
});
