import { render, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } } },
}));

import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

describe("WikiHtmlContent and forum wiki embeds", () => {
  it("keeps an embed's data attributes once the content is re-rendered as React elements", async () => {
    const html =
      '<div class="forum-wiki-embed" data-wiki-embed="image" data-wiki-title="File:A.png" data-width="300" data-other="x"><a href="https://ixwiki.com/wiki/File:A.png">File:A.png</a></div>';
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("[data-wiki-embed]")).not.toBeNull());
    const embed = container.querySelector(".forum-wiki-embed")!;
    expect(embed.getAttribute("data-wiki-embed")).toBe("image");
    expect(embed.getAttribute("data-wiki-title")).toBe("File:A.png");
    expect(embed.getAttribute("data-width")).toBe("300");
    expect(embed.hasAttribute("data-other")).toBe(false);
  });
});

describe("WikiHtmlContent attributes", () => {
  it("keeps an image's width and height, and still drops other data attributes and event handlers", async () => {
    const html =
      '<p data-other="x" onclick="alert(1)"><img src="https://x/y.png" alt="" width="320" height="200" onerror="alert(2)" data-other="y"><a href="https://e.com/" onmouseover="alert(3)">l</a></p>';
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("320");
    expect(img.getAttribute("height")).toBe("200");
    const names = Array.from(container.querySelectorAll("*")).flatMap((el) => el.getAttributeNames());
    expect(names.filter((name) => name.startsWith("on") || name.startsWith("data-"))).toEqual([]);
  });
});
