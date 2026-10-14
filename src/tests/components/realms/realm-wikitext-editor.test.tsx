/**
 * The factbook and rules editor hosts the canvas bare (its Save is the only save), never restores a local wiki
 * draft over the server text, and saves the canvas's latest complete wikitext, refusing while part of it has none.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

interface MockEditorProps {
  bare?: boolean;
  restoreLocalDraft?: boolean;
  onSerializedWikitext: (result: { wikitext: string; complete: boolean }) => void;
}
let mockEditorProps: MockEditorProps | null = null;
jest.mock("next/dynamic", () => () => (props: MockEditorProps) => {
  mockEditorProps = props;
  return null;
});

import { RealmWikitextEditor } from "~/app/r/[realm]/_components/manage/RealmWikitextEditor";

function renderEditor() {
  const onSave = jest.fn();
  render(
    <RealmWikitextEditor
      editorKey="factbook:aurelia"
      editorTitle="Realm factbook aurelia"
      initialWikitext="Old"
      saveLabel="Save factbook"
      sourceLabel="Factbook wikitext"
      saving={false}
      onSave={onSave}
    />
  );
  return onSave;
}

const report = (wikitext: string, complete: boolean) =>
  act(() => mockEditorProps?.onSerializedWikitext({ wikitext, complete }));

describe("RealmWikitextEditor", () => {
  it("hosts the canvas bare, without restoring a local draft", () => {
    renderEditor();
    expect(mockEditorProps).toMatchObject({ bare: true, restoreLocalDraft: false });
  });

  it("saves the latest complete wikitext, and refuses while part of it has none", () => {
    const onSave = renderEditor();
    const save = screen.getByRole("button", { name: "Save factbook" }) as HTMLButtonElement;

    report("New", true);
    fireEvent.click(save);
    expect(onSave).toHaveBeenLastCalledWith("New");

    report("New", false);
    expect(save.disabled).toBe(true);
    expect(screen.getByText("Part of this cannot be saved yet")).toBeTruthy();

    report("Fixed", true);
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenLastCalledWith("Fixed");
  });
});
