/**
 * C1c (plan 2026-10-25 sister wikis, Task 8): what media search copies for a file. A sister wiki's file is not
 * IxWiki's, so `[[File:X]]` would name a file IxWiki does not have: it copies a link to the file's page on its
 * own wiki instead. A Commons or IxWiki file keeps the four wikitext formats.
 */
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import {
  CopyFormatSelector,
  copyFormatText,
  copyFormatsFor,
} from "~/components/wiki-os/media-search/CopyFormatSelector";
import {
  imageFromUrl,
  wikiFilesToImages,
  type CommonsImage,
} from "~/components/wiki-os/media-search/types";
import { publicArticleUrl } from "~/lib/wiki-os/config";

const image = (over: Partial<CommonsImage>): CommonsImage => ({
  ...imageFromUrl("https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.svg"),
  title: "File:Flag of Avalon.svg",
  ...over,
});

const FOUR = ["thumb", "embed", "raw", "url"];

describe("copy formats", () => {
  it("a sister wiki file copies a link to its page on that wiki, never [[File:]]", () => {
    for (const descriptionUrl of [
      "https://iiwiki.com/wiki/File:Flag_of_Avalon.svg",
      "https://www.iiwiki.com/wiki/File:Flag_of_Avalon.svg",
      "https://iiwiki.us/wiki/File:Flag_of_Avalon.svg",
      "//althistory.fandom.com/wiki/File:Flag_of_Avalon.svg",
    ]) {
      const file = image({ descriptionUrl });
      const formats = copyFormatsFor(file);
      expect(formats).toEqual(["link", "url"]);
      for (const format of formats) expect(copyFormatText(format, file)).not.toContain("[[");
      expect(copyFormatText("link", file)).toBe(`[${descriptionUrl} Flag of Avalon.svg]`);
    }
  });

  it("an iiwiki file from the repository search copies a link to iiwiki's file page", () => {
    const [file] = wikiFilesToImages(
      [
        {
          name: "Flag_of_Avalon.svg",
          size: 2048,
          width: 10,
          height: 10,
          url: "https://iiwiki.com/images/a/ab/Flag_of_Avalon.svg",
        },
      ],
      "iiwiki"
    );
    expect(copyFormatsFor(file!)).toEqual(["link", "url"]);
    expect(copyFormatText("link", file!)).toBe(
      `[${publicArticleUrl("File:Flag_of_Avalon.svg", "iiwiki")} Flag of Avalon.svg]`
    );
  });

  it("a Commons or IxWiki file keeps the four formats", () => {
    const commons = image({
      descriptionUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Avalon.svg",
    });
    const ixwiki = image({ descriptionUrl: publicArticleUrl("File:Flag of Avalon.svg") });
    const ownUpload = image({ descriptionUrl: "/api/wiki/file/Flag_of_Avalon.svg" });
    // Only an http(s) page on the sister wiki's host is that wiki's.
    const notHttp = image({ descriptionUrl: "ftp://iiwiki.com/wiki/File:Flag_of_Avalon.svg" });
    for (const file of [commons, ixwiki, ownUpload, notHttp])
      expect(copyFormatsFor(file)).toEqual(FOUR);
    expect(copyFormatText("raw", ixwiki)).toBe("[[File:Flag of Avalon.svg]]");
    expect(copyFormatText("thumb", commons)).toBe(
      "[[File:Flag of Avalon.svg|thumb|Flag of Avalon.svg]]"
    );
  });

  it("the selector shows only the formats it is given", () => {
    render(
      createElement(CopyFormatSelector, {
        formats: ["link", "url"],
        value: "link",
        onValueChange: jest.fn(),
      })
    );
    const names = screen.getAllByRole("radio").map((radio) => radio.textContent);
    expect(names).toEqual(["Link", "URL"]);
    expect(screen.getByRole("radio", { name: "Link" })).toHaveAttribute("aria-checked", "true");
  });
});
