/**
 * The league creator's cover image: the sport's Commons category is asked for only once the dialog is open on step 2
 * or later, one file is picked once per preset (never over a cover already chosen), shuffle moves to another file,
 * remove leaves the cover empty, and reset clears it so the preset's pick runs again.
 */
import { act, renderHook } from "@testing-library/react";

interface CommonsResult {
  data: { images: { url: string }[] } | undefined;
  isLoading: boolean;
}

const mockUseQuery = jest.fn<
  CommonsResult,
  [{ category: string; limit: number }, { enabled: boolean }]
>();

jest.mock("~/trpc/react", () => ({
  api: {
    commons: {
      getCategoryFiles: {
        useQuery: (input: { category: string; limit: number }, options: { enabled: boolean }) =>
          mockUseQuery(input, options),
      },
    },
  },
}));

import { useLeagueCoverImage } from "~/hooks/useLeagueCoverImage";

const images = (...urls: string[]) => ({ images: urls.map((url) => ({ url })) });

interface Props {
  open: boolean;
  selectedPresetKey: string | null;
  currentStep: number;
}

const renderCover = (initial: Props) =>
  renderHook((props: Props) => useLeagueCoverImage(props), { initialProps: initial });

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useLeagueCoverImage", () => {
  it("asks for the sport's Commons category only when open on step 2 or later", () => {
    const { rerender } = renderCover({ open: true, selectedPresetKey: "soccer", currentStep: 1 });
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      { category: "Association football stadiums", limit: 35 },
      { enabled: false }
    );

    rerender({ open: true, selectedPresetKey: "soccer", currentStep: 2 });
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      { category: "Association football stadiums", limit: 35 },
      { enabled: true }
    );

    rerender({ open: false, selectedPresetKey: "soccer", currentStep: 2 });
    expect(mockUseQuery).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });

    rerender({ open: true, selectedPresetKey: "curling", currentStep: 2 });
    expect(mockUseQuery).toHaveBeenLastCalledWith({ category: "", limit: 35 }, { enabled: false });
  });

  it("picks one of the category's files as the cover, once", () => {
    mockUseQuery.mockReturnValue({ data: images("a.jpg", "b.jpg", "c.jpg"), isLoading: false });
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const { result } = renderCover({ open: true, selectedPresetKey: "hockey", currentStep: 2 });

    expect(result.current.coverImage).toBe("b.jpg");
    expect(result.current.commonsData).toEqual(images("a.jpg", "b.jpg", "c.jpg"));
  });

  it("picks nothing without files or a preset", () => {
    mockUseQuery.mockReturnValue({ data: images(), isLoading: false });
    const { result, rerender } = renderCover({
      open: true,
      selectedPresetKey: "hockey",
      currentStep: 2,
    });
    expect(result.current.coverImage).toBeNull();

    mockUseQuery.mockReturnValue({ data: images("a.jpg"), isLoading: true });
    rerender({ open: true, selectedPresetKey: null, currentStep: 2 });
    expect(result.current.coverImage).toBeNull();
    expect(result.current.commonsLoading).toBe(true);
  });

  it("never replaces a cover already chosen", () => {
    const { result, rerender } = renderCover({
      open: true,
      selectedPresetKey: "f1",
      currentStep: 2,
    });
    act(() => result.current.setCoverImage("mine.jpg"));

    mockUseQuery.mockReturnValue({ data: images("a.jpg"), isLoading: false });
    rerender({ open: true, selectedPresetKey: "f1", currentStep: 2 });
    expect(result.current.coverImage).toBe("mine.jpg");

    rerender({ open: true, selectedPresetKey: "boxing", currentStep: 2 });
    expect(result.current.coverImage).toBe("mine.jpg");
  });

  it("shuffles to a different file, or the only one there is", () => {
    mockUseQuery.mockReturnValue({ data: images("a.jpg", "b.jpg"), isLoading: false });
    const { result, rerender } = renderCover({
      open: true,
      selectedPresetKey: "baseball",
      currentStep: 2,
    });
    expect(result.current.coverImage).toBe("a.jpg");

    act(() => result.current.handleShuffleCover());
    expect(result.current.coverImage).toBe("b.jpg");
    act(() => result.current.handleShuffleCover());
    expect(result.current.coverImage).toBe("a.jpg");

    mockUseQuery.mockReturnValue({ data: images("a.jpg"), isLoading: false });
    rerender({ open: true, selectedPresetKey: "baseball", currentStep: 2 });
    act(() => result.current.handleShuffleCover());
    expect(result.current.coverImage).toBe("a.jpg");
  });

  it("does nothing on shuffle with no files", () => {
    const { result } = renderCover({ open: true, selectedPresetKey: "soccer", currentStep: 2 });
    act(() => result.current.setCoverImage("mine.jpg"));
    act(() => result.current.handleShuffleCover());
    expect(result.current.coverImage).toBe("mine.jpg");
  });

  it("leaves the cover empty after remove, and picks again after reset", () => {
    mockUseQuery.mockReturnValue({ data: images("a.jpg", "b.jpg"), isLoading: false });
    const { result } = renderCover({
      open: true,
      selectedPresetKey: "basketball",
      currentStep: 2,
    });
    expect(result.current.coverImage).toBe("a.jpg");

    act(() => result.current.handleRemoveCover());
    expect(result.current.coverImage).toBeNull();

    jest.spyOn(Math, "random").mockReturnValue(0.9);
    act(() => result.current.resetCover());
    expect(result.current.coverImage).toBe("b.jpg");
  });

  it("picks again for a new preset once the cover is removed", () => {
    mockUseQuery.mockReturnValue({ data: images("a.jpg", "b.jpg"), isLoading: false });
    const { result, rerender } = renderCover({
      open: true,
      selectedPresetKey: "soccer",
      currentStep: 2,
    });
    act(() => result.current.handleRemoveCover());
    rerender({ open: true, selectedPresetKey: "soccer", currentStep: 3 });
    expect(result.current.coverImage).toBeNull();

    jest.spyOn(Math, "random").mockReturnValue(0.9);
    rerender({ open: true, selectedPresetKey: "football", currentStep: 3 });
    expect(result.current.coverImage).toBe("b.jpg");
  });
});
