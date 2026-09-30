import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WikiVisualEditor } from "~/components/wiki-os/editor/WikiVisualEditor";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";

/** What the mocked Plate canvas reports as its value; the real serializer turns it into wikitext. */
let mockNodes: unknown[] = [];
const mockNotifyError = jest.fn();

jest.mock("~/hooks/useNavigationScroll", () => ({ useNavigationScroll: () => ({ repulsionProgress: 0 }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: (...args: unknown[]) => mockNotifyError(...args) }),
}));
jest.mock("~/components/wiki-os/editor/hooks/useWikiVisualFormatting", () => ({
  useWikiVisualFormatting: () => ({
    activeFormats: {},
    refreshActiveFormats: jest.fn(),
    editingTemplate: null,
    setEditingTemplate: jest.fn(),
  }),
}));
jest.mock("~/components/wiki-os/editor/components/WikiVisualToolbar", () => ({
  WikiVisualToolbar: (props: { onSave: () => void; handleSaveDraft: () => void }) => (
    <div>
      <button onClick={props.onSave}>publish</button>
      <button onClick={props.handleSaveDraft}>save-draft</button>
    </div>
  ),
}));
jest.mock("~/components/wiki-os/editor/components/WikiEditorSavePanel", () => ({ WikiEditorSavePanel: () => null }));
jest.mock("~/components/wiki-os/editor/components/WikiEditorModalHost", () => ({ WikiEditorModalHost: () => null }));
jest.mock("~/components/wiki-os/editor/components/WikiEditorStatusBar", () => ({ WikiEditorStatusBar: () => null }));
jest.mock("~/components/wiki-os/editor/plate/PlateWikiEditor", () => ({
  PlateWikiEditor: (props: {
    initialWikitext?: string;
    onEditorReady: (editor: unknown) => void;
    onValueChange: (nodes: unknown[], html: string, text: string) => void;
  }) => {
    React.useEffect(() => {
      props.onEditorReady({});
      props.onValueChange(mockNodes, "<p>html that must never be saved</p>", "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="canvas">{props.initialWikitext}</div>;
  },
}));

const paragraph = (text: string) => ({ type: "p", children: [{ text }] });

const setup = (props: Partial<React.ComponentProps<typeof WikiVisualEditor>> = {}) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<WikiVisualEditor title="Vesperia" initialWikitext="Start" onSave={onSave} onCancel={jest.fn()} onSwitchToSource={jest.fn()} {...props} />);
  return { onSave };
};

describe("WikiVisualEditor drafts and what a save writes (review fixes 7-8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.clear();
    mockNodes = [paragraph("Edited text.")];
  });

  it("does not write a draft after a successful publish", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await act(async () => undefined);
    expect(onSave).toHaveBeenCalledWith("Edited text.", "", false, false);
    expect(getDraft("Vesperia")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("keeps the work as a draft when the publish fails", async () => {
    const { onSave } = setup();
    onSave.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(getDraft("Vesperia")?.wikitext).toBe("Edited text."));
  });

  it("saves empty wikitext for an emptied document, never the HTML of the editor", async () => {
    mockNodes = [paragraph("")];
    const { onSave } = setup();
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toBe("");
  });

  it("'Save draft' stores the wikitext in the wikitext field", async () => {
    setup();
    fireEvent.click(screen.getByText("save-draft"));
    await waitFor(() => expect(getDraft("Vesperia")).not.toBeNull());
    const draft = getDraft("Vesperia")!;
    expect(draft.wikitext).toBe("Edited text.");
    expect(draft.html).toBeUndefined();
    expect(draft.mode).toBe("visual");
  });

  it("starts from a local draft by default and ignores it when the host settles drafts itself", () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "visual", wikitext: "From the draft" });
    setup();
    expect(screen.getByTestId("canvas").textContent).toBe("From the draft");
  });

  it("does not start from a draft when restoreLocalDraft is false", () => {
    saveDraft({ title: "Vesperia", source: "ixwiki", mode: "visual", wikitext: "From the draft" });
    setup({ restoreLocalDraft: false });
    expect(screen.getByTestId("canvas").textContent).toBe("Start");
  });

  it("hands the host a reader of the editor's content, and withdraws it on unmount", () => {
    const register = jest.fn();
    const view = render(
      <WikiVisualEditor title="Vesperia" initialWikitext="Start" onSave={jest.fn()} onCancel={jest.fn()} onSwitchToSource={jest.fn()} registerContentReader={register} />
    );
    const reader = register.mock.calls[0]![0] as () => string | null;
    expect(reader()).toBe("Edited text.");
    view.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });
});
