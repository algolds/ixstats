/**
 * The picker's upload tab runs one upload at a time and names the real failure.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UploadTab } from "~/components/wiki-os/media-search/UploadTab";
import { UploadImageError } from "~/lib/media/upload-image";

const mockUpload = jest.fn();
const mockNotify = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  notify: jest.fn(),
};

jest.mock("~/lib/media/upload-image", () => ({
  ...jest.requireActual("~/lib/media/upload-image"),
  uploadImageFile: (...args: unknown[]) => mockUpload(...args),
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

const png = (name: string) => new File(["bytes"], name, { type: "image/png" });

function renderTab() {
  const onImageSelect = jest.fn();
  const onClose = jest.fn();
  const setIsUploading = jest.fn();
  const view = render(
    <UploadTab
      onImageSelect={onImageSelect}
      onClose={onClose}
      isUploading={false}
      setIsUploading={setIsUploading}
    />
  );
  const dropZone = screen.getByText("Drag, drop or paste your image").closest("div")!;
  const drop = (file: File) => fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
  return { ...view, onImageSelect, onClose, drop };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("UploadTab", () => {
  it("ignores a second file dropped while the first upload is pending", async () => {
    let finish!: (url: string) => void;
    mockUpload.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      })
    );
    const { drop, onImageSelect } = renderTab();

    drop(png("one.png"));
    drop(png("two.png"));
    expect(mockUpload).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish("/images/uploads/one.png");
    });
    await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith("/images/uploads/one.png"));
  });

  it("names a rate limit instead of blaming the connection", async () => {
    mockUpload.mockRejectedValue(new UploadImageError("Too many uploads", 429, 30));
    const { drop, onImageSelect } = renderTab();

    drop(png("one.png"));

    await waitFor(() =>
      expect(mockNotify.error).toHaveBeenCalledWith(
        "Upload limit reached",
        "Please try again in 30 seconds."
      )
    );
    expect(onImageSelect).not.toHaveBeenCalled();
  });

  it("reports a rejected upload by its message, not as a connection failure", async () => {
    mockUpload.mockRejectedValue(new UploadImageError("Upload failed", 413));
    const { drop } = renderTab();

    drop(png("big.png"));

    await waitFor(() => expect(mockNotify.error).toHaveBeenCalledWith("Upload failed"));
    expect(mockNotify.error).not.toHaveBeenCalledWith(
      "Upload failed",
      "Could not connect to the server."
    );
  });
});
