/**
 * Plan 411: the two upload forms (the editor's image dialog and Special:Upload). The file goes to POST /api/wiki/upload as the
 * request body; MediaWiki-style warnings stop the upload until the uploader presses "Upload anyway"; nothing is sent
 * for a file over the limit; a form for someone who may not upload says so.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";
import WikiUploadPage from "~/app/(wiki-os)/util/upload/page";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";

jest.mock("~/components/wiki-os/editor/ImageSearchGrid", () => ({
  ImageSearchGrid: () => <div />,
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const fetchMock = jest.fn();
const answer = (body: object, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "Flag.png", { type: "image/png" });
const success = {
  result: "Success",
  filename: "Flag.png",
  title: "File:Flag.png",
  url: "/api/wiki/file/Flag.png",
  descriptionUrl: "/wiki/File:Flag.png",
  width: 4,
  height: 4,
  size: 4,
  mime: "image/png",
  sha1: "a".repeat(40),
  replaced: false,
  noChange: false,
};
const warning = {
  result: "Warning",
  filename: "Flag.png",
  title: "File:Flag.png",
  warnings: { exists: "Flag.png" },
};

/** The calls to the upload route (not the access check). */
const uploads = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  globalThis.URL.createObjectURL = jest.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = jest.fn();
});

describe("the editor's image dialog", () => {
  function openUploadTab() {
    const onInsert = jest.fn();
    const onClose = jest.fn();
    const view = render(<ImageSearchModal isOpen onClose={onClose} onInsert={onInsert} />);
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    return { onInsert, onClose, input };
  }

  it("sends the file as the request body and inserts the file it was given", async () => {
    fetchMock.mockResolvedValue(answer(success));
    const { onInsert, onClose, input } = openUploadTab();
    const file = png();

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(await screen.findByLabelText(/license/i), {
      target: { value: "{{PD-self}}" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Upload & Insert" }));

    await waitFor(() => expect(onInsert).toHaveBeenCalledWith("[[File:Flag.png|thumb|right]]"));
    expect(onClose).toHaveBeenCalled();
    const [[url, init]] = uploads();
    expect(init.body).toBe(file);
    expect(init.headers).toEqual({ "Content-Type": "image/png" });
    const query = new URL(url, "http://localhost").searchParams;
    expect(query.get("filename")).toBe("Flag.png");
    expect(query.get("license")).toBe("{{PD-self}}");
    expect(query.has("ignorewarnings")).toBe(false);
  });

  it("stops at a warning and goes on only when told to", async () => {
    fetchMock.mockResolvedValueOnce(answer(warning)).mockResolvedValueOnce(answer(success));
    const { onInsert, input } = openUploadTab();
    fireEvent.change(input, { target: { files: [png()] } });

    fireEvent.click(await screen.findByRole("button", { name: "Upload & Insert" }));

    expect(await screen.findByText(/already exists/)).toBeTruthy();
    expect(onInsert).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Upload anyway" }));

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    expect(new URL(uploads()[1]![0], "http://localhost").searchParams.get("ignorewarnings")).toBe(
      "1"
    );
  });

  it("shows why a refused upload was refused, and inserts nothing", async () => {
    fetchMock.mockResolvedValue(
      answer(
        {
          error: "This SVG was refused because it contains a <script> element.",
          code: "unsafe-svg",
        },
        400
      )
    );
    const { onInsert, input } = openUploadTab();
    fireEvent.change(input, { target: { files: [png()] } });

    fireEvent.click(await screen.findByRole("button", { name: "Upload & Insert" }));

    expect(await screen.findByText(/refused because it contains a <script> element/)).toBeTruthy();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("does not take a file over the limit", async () => {
    const alert = jest.spyOn(window, "alert").mockImplementation(() => undefined);
    const { input } = openUploadTab();
    const big = new File([new Uint8Array(1)], "Big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });

    fireEvent.change(input, { target: { files: [big] } });

    expect(alert).toHaveBeenCalledWith(expect.stringContaining("10 MB"));
    expect(screen.queryByRole("button", { name: "Upload & Insert" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe("Special:Upload", () => {
  const allowed = answer({ signedIn: true, canUpload: true });

  it("tells someone who is signed out to sign in, and someone without the right what it takes", async () => {
    fetchMock.mockResolvedValueOnce(answer({ signedIn: false, canUpload: false }));
    const { unmount } = render(<WikiUploadPage />);
    expect(await screen.findByText("Sign in to upload")).toBeTruthy();
    unmount();

    fetchMock.mockResolvedValueOnce(answer({ signedIn: true, canUpload: false }));
    render(<WikiUploadPage />);
    expect(await screen.findByText("You cannot upload files yet")).toBeTruthy();
    expect(screen.queryByLabelText("File")).toBeNull();
  });

  it("uploads, warns about a name that is taken, uploads anyway and links the file page", async () => {
    fetchMock
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce(answer(warning))
      .mockResolvedValueOnce(answer({ ...success, replaced: true }));
    render(<WikiUploadPage />);

    fireEvent.change(await screen.findByLabelText("File"), { target: { files: [png()] } });
    // the name is taken from the file
    expect((screen.getByLabelText("Name on the wiki") as HTMLInputElement).value).toBe("Flag.png");
    fireEvent.change(screen.getByLabelText("Categories"), { target: { value: "Flags, Eurth" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText(/already exists/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload anyway" }));

    expect(await screen.findByText("New version uploaded")).toBeTruthy();
    const link = screen.getByRole("link", { name: "View the file page" });
    expect(link.getAttribute("href")).toContain("/wiki/File:Flag.png");
    const second = new URL(uploads()[1]![0], "http://localhost").searchParams;
    expect(second.get("ignorewarnings")).toBe("1");
    expect(second.getAll("category")).toEqual(["Flags", "Eurth"]);
  });

  it("says when the same file is already the current version", async () => {
    fetchMock
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce(answer({ ...success, replaced: true, noChange: true }));
    render(<WikiUploadPage />);

    fireEvent.change(await screen.findByLabelText("File"), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Nothing to upload")).toBeTruthy();
  });

  it("shows a refusal and keeps the form", async () => {
    fetchMock.mockResolvedValueOnce(allowed).mockResolvedValueOnce(
      answer(
        {
          error: "protectedpage: This page is protected from upload (sysop).",
          code: "protectedpage",
        },
        403
      )
    );
    render(<WikiUploadPage />);

    fireEvent.change(await screen.findByLabelText("File"), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText(/protected from upload/)).toBeTruthy();
    expect(screen.getByLabelText("Name on the wiki")).toBeTruthy();
  });
});
