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
