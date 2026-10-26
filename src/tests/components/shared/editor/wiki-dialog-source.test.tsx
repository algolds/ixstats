/**
 * The composer's wiki dialog: its selector covers every wiki WikiOS reads, and a result of the search across all
 * wikis is inserted from its own wiki, whatever the selector said before.
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  WikiAndStashPopovers,
  type WikiSearchResult,
} from "~/components/shared/editor/WikiAndStashPopovers";
import type { WikiSource } from "~/lib/wiki-os/config";

jest.mock("~/components/thinkpages/EmojiPicker", () => ({ EmojiPicker: () => null }));

const RESULTS: WikiSearchResult[] = [
  { title: "Gallambria Republic", source: "iiwiki" },
  { title: "Pax Atomica", source: "althistory" },
  { title: "Port of Ixnay", source: "ixwiki" },
];

/** The dialog with the editor's state for the wiki and title, recording what each insert would use. */
function Harness({ onInsert }: { onInsert: (target: string, source: WikiSource) => void }) {
  const [source, setSource] = useState<WikiSource>("ixwiki");
  const [target, setTarget] = useState("");
  const noop = () => undefined;
  const idle = { isLoading: false, data: undefined };
  return (
    <WikiAndStashPopovers
      isWikiOpen
      setIsWikiOpen={noop}
      wikiInsertMode="link"
      setWikiInsertMode={noop}
      wikiSource={source}
      setWikiSource={setSource}
      wikiTarget={target}
      setWikiTarget={setTarget}
      wikiLabel=""
      setWikiLabel={noop}
      wikiSearchResults={RESULTS}
      isSearchingWiki={false}
      wikiIntroQuery={idle}
      wikiImagesQuery={idle}
      selectedWikiImageUrl=""
      setSelectedWikiImageUrl={noop}
      insertWikiLink={() => onInsert(target, source)}
      isStashesOpen={false}
      setIsStashesOpen={noop}
      stashes={[]}
      activeStashId=""
      setSelectedStashId={noop}
      stashesQuery={idle}
      stashItemsQuery={idle}
      imageItems={[]}
      resolvedImages={{}}
      insertStashedImage={noop}
      handleSelectEmoji={noop}
      setIsEmojiOpen={noop}
    />
  );
}

const pressed = () =>
  screen
    .getAllByRole("button", { pressed: true })
    .map((button) => button.textContent)
    .filter((text) => ["Wiki", "IIWiki", "AltHistory"].includes(text ?? ""));

describe("the composer's wiki dialog", () => {
  it("offers all three wikis, AltHistory included", () => {
    const onInsert = jest.fn();
    render(<Harness onInsert={onInsert} />);
    const group = screen.getByRole("group", { name: "Wiki" });
    expect(Array.from(group.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "Wiki",
      "IIWiki",
      "AltHistory",
    ]);
    expect(pressed()).toEqual(["Wiki"]);
    fireEvent.click(screen.getByRole("button", { name: "AltHistory" }));
    expect(pressed()).toEqual(["AltHistory"]);
  });

  it.each([
    ["Gallambria Republic", "iiwiki", "IIWiki"],
    ["Pax Atomica", "althistory", "AltHistory Wiki"],
  ] as const)(
    "clicking %s in a search of all wikis inserts it from %s, though the selector said Wiki",
    (title, source, name) => {
      const onInsert = jest.fn();
      render(<Harness onInsert={onInsert} />);
      const result = screen.getByRole("button", { name: new RegExp(`^${title}`) });
      expect(result.textContent).toBe(`${title}${name}`);
      fireEvent.click(result);
      fireEvent.click(screen.getByRole("button", { name: "Insert Link" }));
      expect(onInsert).toHaveBeenCalledWith(title, source);
    }
  );

  it("an IxWiki result switches a sister selector back to IxWiki", () => {
    const onInsert = jest.fn();
    render(<Harness onInsert={onInsert} />);
    fireEvent.click(screen.getByRole("button", { name: "IIWiki" }));
    fireEvent.click(screen.getByRole("button", { name: /^Port of Ixnay/ }));
    fireEvent.click(screen.getByRole("button", { name: "Insert Link" }));
    expect(onInsert).toHaveBeenCalledWith("Port of Ixnay", "ixwiki");
  });
});
