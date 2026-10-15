/**
 * Realm banner and thumbnail field: a file goes through the site's image upload route and its address fills the
 * field, or an image is picked from the repository; the typed address is checked; files that are not images or
 * exceed 5MB never leave the browser.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => notify }));
jest.mock("~/lib/media/upload-image", () => ({ uploadImageFile: jest.fn() }));
// The repository picker: a stand-in that picks one downloaded image.
jest.mock("next/dynamic", () => () => (props: { onImageSelect: (url: string) => void }) => (
  <button type="button" onClick={() => props.onImageSelect("/images/downloaded/downloaded_ab.png")}>
    Pick
  </button>
));

import { uploadImageFile } from "~/lib/media/upload-image";
import { RealmImageField } from "~/app/r/[realm]/_components/manage/RealmImageField";

const upload = uploadImageFile as jest.Mock;

function renderField(value = "") {
  const onChange = jest.fn();
  render(
    <RealmImageField
      id="banner"
      label="Banner image"
      value={value}
      onChange={onChange}
      previewClassName="h-28 w-full"
    />
  );
  return onChange;
}

const file = (type: string, size: number) => {
  const f = new File(["x"], "banner.png", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

beforeEach(() => {
  upload.mockReset();
  notify.error.mockClear();
});

describe("RealmImageField", () => {
  it("uploads a chosen image and puts its address in the field", async () => {
    upload.mockResolvedValue("/images/uploads/uploaded_1_ab_banner.png");
    const onChange = renderField();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload banner image"), {
        target: { files: [file("image/png", 1024)] },
      });
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("/images/uploads/uploaded_1_ab_banner.png");
  });

  it("refuses files that are not images, or over 5MB, before uploading", async () => {
    renderField();
    const input = screen.getByLabelText("Upload banner image");
    await act(async () => {
      fireEvent.change(input, { target: { files: [file("application/pdf", 10)] } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file("image/png", 6 * 1024 * 1024)] } });
    });
    expect(upload).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it("previews an uploaded image", () => {
    renderField("/images/uploads/uploaded_1_ab_banner.png");
    expect(screen.getByAltText("Banner image preview").getAttribute("src")).toContain(
      "/images/uploads/uploaded_1_ab_banner.png"
    );
  });

  it("previews an outside image without a referrer, which hotlink-protected hosts refuse", () => {
    renderField("https://eurth.org/uploads/default/original/2X/b/emblem.png");
    expect(screen.getByAltText("Banner image preview").getAttribute("referrerpolicy")).toBe(
      "no-referrer"
    );
  });

  it("hides the address box for an uploaded image, offering Replace and Remove", () => {
    const onChange = renderField("/images/uploads/uploaded_1_ab_banner.png");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("group", { name: "Banner image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the address box for an https image, with no Remove", () => {
    renderField("https://img.example/banner.png");
    expect(screen.getByRole("textbox", { name: "Banner image" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("fills the field with an image picked from the repository", () => {
    const onChange = renderField();
    fireEvent.click(screen.getByRole("button", { name: "Repository" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    expect(onChange).toHaveBeenCalledWith("/images/downloaded/downloaded_ab.png");
  });

  it("flags an address that is neither https nor an upload", () => {
    renderField("http://img.example/banner.png");
    expect(
      screen.getByText(
        "Use an https:// image address, upload an image or pick one from the repository."
      )
    ).toBeTruthy();
    expect(screen.queryByAltText("Banner image preview")).toBeNull();
  });
});
