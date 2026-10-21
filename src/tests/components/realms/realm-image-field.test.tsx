/**
 * Realm banner and thumbnail field: a file goes through the site's image upload route and its address fills the
 * field, or an image is picked from the repository; the typed address is checked; files that are not images or
 * exceed 5MB never leave the browser.
 */
import "react";
import { render, screen } from "@testing-library/react";

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

beforeEach(() => {
  upload.mockReset();
  notify.error.mockClear();
});

describe("RealmImageField", () => {
  it("previews an outside image without a referrer, which hotlink-protected hosts refuse", () => {
    renderField("https://eurth.org/uploads/default/original/2X/b/emblem.png");
    expect(screen.getByAltText("Banner image preview").getAttribute("referrerpolicy")).toBe(
      "no-referrer"
    );
  });
});
