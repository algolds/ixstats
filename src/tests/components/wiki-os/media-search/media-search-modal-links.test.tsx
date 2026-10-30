/**
 * The picker points at the full repository and says where each of its two uploads goes: the Upload tab saves a
 * private asset ("My uploads"); the wiki upload at /util/upload is the MediaWiki file upload.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/lib/media", () => ({
  processImageSelection: jest.fn(),
  isExternalImageUrl: () => false,
}));
jest.mock("~/components/wiki-os/media-search/WikiRepositoryTab", () => ({
  WikiRepositoryTab: () => null,
}));

import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";
import { UploadTab } from "~/components/wiki-os/media-search/UploadTab";

describe("the picker's links", () => {
  it("the modal footer links to the full repository in a new tab", () => {
    render(<MediaSearchModal isOpen onClose={jest.fn()} onImageSelect={jest.fn()} />);

    const link = screen.getByRole("link", { name: "Open the full repository" });
    expect(link.getAttribute("href")).toMatch(/\/util\/repository$/);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("the Upload tab says it saves to My uploads and links to the wiki upload", () => {
    render(
      <UploadTab
        onImageSelect={jest.fn()}
        onClose={jest.fn()}
        isUploading={false}
        setIsUploading={jest.fn()}
      />
    );

    expect(
      screen.getByText(
        "Saved to My uploads. Only you see it in the repository; it shows wherever you use it."
      )
    ).toBeTruthy();
    const link = screen.getByRole("link", { name: "Upload to the wiki instead" });
    expect(link.getAttribute("href")).toMatch(/\/util\/upload$/);
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
