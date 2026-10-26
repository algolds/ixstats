/**
 * The composer's embed preview reads `wikios.getIntro` as it answers: its text, "<Wiki> has no page with this title."
 * when the page is missing, "<Wiki> could not be reached just now." when the wiki is down, and the page's images
 * (loaded only as an embed card would load them) to pick from.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import {
  WikiEmbedPreview,
  type WikiEmbedPreviewProps,
} from "~/components/shared/editor/WikiEmbedPreview";
import { unreachableText } from "~/lib/wiki-os/wiki-outage";

type Intro = NonNullable<WikiEmbedPreviewProps["introQuery"]["data"]>;
type Images = NonNullable<WikiEmbedPreviewProps["imagesQuery"]["data"]>;

const intro = (fields: Partial<Intro>): Intro => ({
  title: "Gallambria",
  intro: "",
  text: "",
  source: "iiwiki",
  missing: false,
  ...fields,
});
const image = (url: string, thumbUrl = url): Images[number] => ({
  title: "File:X.png",
  url,
  thumbUrl,
  width: 300,
  height: 200,
});
const idle = { isLoading: false, data: undefined, error: null };

function show(props: Partial<WikiEmbedPreviewProps>) {
  const onSelectImage = jest.fn();
  const view = render(
    <WikiEmbedPreview
      source="iiwiki"
      introQuery={idle}
      imagesQuery={idle}
      selectedImageUrl=""
      onSelectImage={onSelectImage}
      {...props}
    />
  );
  return { ...view, onSelectImage };
}

describe("WikiEmbedPreview", () => {
  it("shows the intro's text", () => {
    show({ introQuery: { ...idle, data: intro({ text: "A republic on Ixnay." }) } });
    expect(screen.getByText("A republic on Ixnay.")).toBeTruthy();
    expect(screen.queryByText("No intro text available.")).toBeNull();
  });

  it("says when the page has no intro", () => {
    show({ introQuery: { ...idle, data: intro({}) } });
    expect(screen.getByText("No intro text available.")).toBeTruthy();
  });

  it("says when the wiki has no page with this title, by the wiki's name", () => {
    show({ source: "althistory", introQuery: { ...idle, data: intro({ missing: true }) } });
    expect(screen.getByText("AltHistory Wiki has no page with this title.")).toBeTruthy();
  });

  it.each([["SERVICE_UNAVAILABLE"], ["TOO_MANY_REQUESTS"]])(
    "says the wiki could not be reached when the read fails with %s",
    (code) => {
      show({ introQuery: { ...idle, error: { data: { code } } } });
      expect(screen.getByText(unreachableText("iiwiki"))).toBeTruthy();
    }
  );

  it("any other failure asks for an exact title", () => {
    show({ introQuery: { ...idle, error: { data: { code: "FORBIDDEN" } } } });
    expect(screen.getByText("Type an exact title to preview.")).toBeTruthy();
  });

  it("says it is loading", () => {
    show({ introQuery: { ...idle, isLoading: true } });
    expect(screen.getByText("Loading article preview...")).toBeTruthy();
  });

  it("offers the page's images through the media proxy, and picks or unpicks one", () => {
    const { container, onSelectImage, rerender } = show({
      introQuery: { ...idle, data: intro({ text: "t" }) },
      imagesQuery: {
        ...idle,
        data: [
          image(
            "https://iiwiki.com/images/a/ab/Flag.png",
            "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png"
          ),
          image("https://evil.example/track.png"),
        ],
      },
    });
    const shown = Array.from(container.querySelectorAll("img"));
    expect(shown.map((img) => img.getAttribute("src"))).toEqual([
      "/api/mediawiki/iiwiki/images/thumb/a/ab/Flag.png/300px-Flag.png",
    ]);
    fireEvent.click(shown[0]!);
    expect(onSelectImage).toHaveBeenCalledWith(
      "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png"
    );
    rerender(
      <WikiEmbedPreview
        source="iiwiki"
        introQuery={{ ...idle, data: intro({ text: "t" }) }}
        imagesQuery={{
          ...idle,
          data: [image("https://iiwiki.com/images/a/ab/Flag.png")],
        }}
        selectedImageUrl="https://iiwiki.com/images/a/ab/Flag.png"
        onSelectImage={onSelectImage}
      />
    );
    fireEvent.click(container.querySelector("img")!);
    expect(onSelectImage).toHaveBeenLastCalledWith("");
  });

  it("offers four images a card can show, even when the first ones listed cannot be shown", () => {
    const offHost = Array.from({ length: 4 }, (_, i) => image(`https://evil.example/${i}.png`));
    const own = Array.from({ length: 5 }, (_, i) =>
      image(`https://iiwiki.com/images/a/ab/F${i}.png`)
    );
    const { container } = show({
      introQuery: { ...idle, data: intro({ text: "t" }) },
      imagesQuery: { ...idle, data: [...offHost, ...own] },
    });
    expect(
      Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"))
    ).toEqual([0, 1, 2, 3].map((i) => `/api/mediawiki/iiwiki/images/a/ab/F${i}.png`));
  });

  it("each image is a button, named and pressed when picked, so the keyboard can pick it", () => {
    const { onSelectImage } = show({
      introQuery: { ...idle, data: intro({ text: "t" }) },
      imagesQuery: {
        ...idle,
        data: [
          { ...image("https://iiwiki.com/images/a/ab/Flag.png"), title: "File:Flag.png" },
          { ...image("https://iiwiki.com/images/b/bc/Seal.png"), title: "File:Seal.png" },
        ],
      },
      selectedImageUrl: "https://iiwiki.com/images/b/bc/Seal.png",
    });
    const flag = screen.getByRole("button", { name: "Use Flag.png on the card" });
    const seal = screen.getByRole("button", { name: "Use Seal.png on the card" });
    expect(flag.getAttribute("aria-pressed")).toBe("false");
    expect(seal.getAttribute("aria-pressed")).toBe("true");
    expect(flag.getAttribute("type")).toBe("button");
    fireEvent.click(flag);
    expect(onSelectImage).toHaveBeenCalledWith("https://iiwiki.com/images/a/ab/Flag.png");
  });

  it("shows no image list for a missing page", () => {
    const { container } = show({
      introQuery: { ...idle, data: intro({ missing: true }) },
      imagesQuery: { ...idle, data: [image("https://iiwiki.com/images/a/ab/Flag.png")] },
    });
    expect(container.querySelector("img")).toBeNull();
  });
});
