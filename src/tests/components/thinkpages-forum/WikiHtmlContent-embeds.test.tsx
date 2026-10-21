import { render, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } } },
}));

import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
describe("WikiHtmlContent attributes", () => {
  it("keeps an image's width and height, and still drops other data attributes and event handlers", async () => {
    const html =
      '<p data-other="x" onclick="alert(1)"><img src="https://x/y.png" alt="" width="320" height="200" onerror="alert(2)" data-other="y"><a href="https://e.com/" onmouseover="alert(3)">l</a></p>';
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("320");
    expect(img.getAttribute("height")).toBe("200");
    const names = Array.from(container.querySelectorAll("*")).flatMap((el) =>
      el.getAttributeNames()
    );
    expect(names.filter((name) => name.startsWith("on") || name.startsWith("data-"))).toEqual([]);
  });
});
