/**
 * The composer's wiki dialog: its selector covers every wiki WikiOS reads, and a result of the search across all
 * wikis is inserted from its own wiki, whatever the selector said before.
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WikiAndStashPopovers } from "~/components/shared/editor/WikiAndStashPopovers";
import type { WikiSearchResult } from "~/components/shared/editor/useWikiDialogQueries";
import type { WikiSource } from "~/lib/wiki-os/config";

jest.mock("~/components/thinkpages/EmojiPicker", () => ({ EmojiPicker: () => null }));

const RESULTS: WikiSearchResult[] = [
  { title: "Gallambria Republic", source: "iiwiki" },
  { title: "Pax Atomica", source: "althistory" },
  { title: "Port of Ixnay", source: "ixwiki" },
];

/** The dialog with the editor's state for the wiki and title, recording what each insert would use. */
function Harness({
  onInsert,
  onSelect = () => undefined,
}: {
  onInsert: (target: string, source: WikiSource) => void;
  onSelect?: (result: WikiSearchResult) => void;
}) {
  const [source, setSource] = useState<WikiSource>("ixwiki");
  const [target, setTarget] = useState("");
  const noop = () => undefined;
  const idle = { isLoading: false, data: undefined, error: null };
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
      selectWikiResult={(result) => {
        onSelect(result);
        setTarget(result.title);
        setSource(result.source);
      }}
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
    .filter((text) => ["Wiki", "IIWiki", "AltHistory Wiki"].includes(text ?? ""));

describe("the composer's wiki dialog", () => {
  it("offers all three wikis by their names, AltHistory included", () => {
    const onInsert = jest.fn();
    render(<Harness onInsert={onInsert} />);
    const group = screen.getByRole("group", { name: "Choose a wiki" });
    expect(Array.from(group.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "Wiki",
      "IIWiki",
      "AltHistory Wiki",
    ]);
    expect(pressed()).toEqual(["Wiki"]);
    fireEvent.click(screen.getByRole("button", { name: "AltHistory Wiki" }));
    expect(pressed()).toEqual(["AltHistory Wiki"]);
  });

  it.each([
    ["Gallambria Republic", "iiwiki", "IIWiki"],
    ["Pax Atomica", "althistory", "AltHistory Wiki"],
  ] as const)(
    "clicking %s in a search of all wikis picks it from %s, though the selector said Wiki",
    (title, source, name) => {
      const onInsert = jest.fn();
      const onSelect = jest.fn();
      render(<Harness onInsert={onInsert} onSelect={onSelect} />);
      const result = screen.getByRole("button", { name: new RegExp(`^${title}`) });
      expect(result.textContent).toBe(`${title}${name}`);
      fireEvent.click(result);
      expect(onSelect).toHaveBeenCalledWith({ title, source });
      fireEvent.click(screen.getByRole("button", { name: "Insert Link" }));
      expect(onInsert).toHaveBeenCalledWith(title, source);
    }
  );

  it("an IxWiki result is labelled Wiki and switches a sister selector back to IxWiki", () => {
    const onInsert = jest.fn();
    render(<Harness onInsert={onInsert} />);
    expect(screen.getByRole("button", { name: /^Port of Ixnay/ }).textContent).toBe(
      "Port of IxnayWiki"
    );
    fireEvent.click(screen.getByRole("button", { name: "IIWiki" }));
    fireEvent.click(screen.getByRole("button", { name: /^Port of Ixnay/ }));
    fireEvent.click(screen.getByRole("button", { name: "Insert Link" }));
    expect(onInsert).toHaveBeenCalledWith("Port of Ixnay", "ixwiki");
  });
});
