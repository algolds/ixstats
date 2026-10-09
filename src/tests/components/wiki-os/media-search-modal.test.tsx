/**
 * The image picker ignores a download the user cancelled, never starts a second download while one is
 * running, and lets Escape close the detail panel before it closes the picker.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

const mockProcess = jest.fn();
const mockNotify = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  notify: jest.fn(),
};

jest.mock("~/lib/media", () => ({
  processImageSelection: (...args: unknown[]) => mockProcess(...args),
  isExternalImageUrl: (url: string) => url.startsWith("https://"),
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/components/wiki-os/media-search/UploadTab", () => ({ UploadTab: () => null }));
jest.mock("~/components/wiki-os/media-search/WikiRepositoryTab", () => ({
  WikiRepositoryTab: (props: {
    selectedImageObj: CommonsImage | null;
    onSelectImage: (img: CommonsImage | null) => void;
    onDoubleClickConfirm: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onSelectImage(IMAGE)}>
        pick
      </button>
      <button type="button" onClick={props.onDoubleClickConfirm}>
        confirm twice
      </button>
      {props.selectedImageObj && <span>detail open</span>}
    </div>
  ),
}));

const IMAGE: CommonsImage = {
  pageid: 1,
  title: "File:A.jpg",
  thumbUrl: "https://example.org/thumb/A.jpg",
  url: "https://example.org/A.jpg",
  descriptionUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
  width: 100,
  height: 100,
  mime: "image/jpeg",
  description: "",
  artist: "",
  license: "",
};

interface Deferred {
  promise: Promise<string>;
  resolve: (url: string) => void;
}
function deferred(): Deferred {
  let resolve!: (url: string) => void;
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("MediaSearchModal", () => {
  it("cancels an in-flight download on Escape and never applies the image", async () => {
    const pending = deferred();
    mockProcess.mockReturnValue(pending.promise);
    const onImageSelect = jest.fn();
    const onClose = jest.fn();
    render(<MediaSearchModal isOpen onClose={onClose} onImageSelect={onImageSelect} />);

    fireEvent.click(screen.getByText("pick"));
    fireEvent.click(screen.getByRole("button", { name: "Select Image" }));
    await waitFor(() => expect(mockProcess).toHaveBeenCalledTimes(1));

    // The first Escape cancels the download; the picker stays open until a later Escape.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    const { signal } = mockProcess.mock.calls[0]![1] as { signal: AbortSignal };
    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("detail open")).toBeInTheDocument();
    // The second Escape closes the detail panel and the third closes the picker.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("detail open")).not.toBeInTheDocument());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    await act(async () => {
      pending.resolve("/images/uploads/A.jpg");
      await pending.promise;
    });
    expect(onImageSelect).not.toHaveBeenCalled();
    expect(mockNotify.success).not.toHaveBeenCalled();
  });

  it("starts only one download when confirm fires twice", async () => {
    const pending = deferred();
    mockProcess.mockReturnValue(pending.promise);
    const onImageSelect = jest.fn();
    render(<MediaSearchModal isOpen onClose={jest.fn()} onImageSelect={onImageSelect} />);

    fireEvent.click(screen.getByText("pick"));
    fireEvent.click(screen.getByText("confirm twice"));
    fireEvent.click(screen.getByText("confirm twice"));
    expect(mockProcess).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve("/images/uploads/A.jpg");
      await pending.promise;
    });
    expect(onImageSelect).toHaveBeenCalledTimes(1);
    expect(onImageSelect).toHaveBeenCalledWith("/images/uploads/A.jpg");
  });

  it("closes the detail panel on the first Escape and the picker on the second", async () => {
    const onClose = jest.fn();
    render(<MediaSearchModal isOpen onClose={onClose} onImageSelect={jest.fn()} />);

    fireEvent.click(screen.getByText("pick"));
    expect(screen.getByText("detail open")).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("detail open")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
