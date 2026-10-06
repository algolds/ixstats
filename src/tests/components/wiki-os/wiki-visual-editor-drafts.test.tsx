import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WikiVisualEditor } from "~/components/wiki-os/editor/WikiVisualEditor";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";

/** What the mocked Plate canvas reports as its value; the real serializer turns it into wikitext. */
let mockNodes: unknown[] = [];
/** The canvas's change callback, so a test can report an edit after the mount report. */
let reportValue: (nodes: unknown[]) => void = () => undefined;
const mockNotifyError = jest.fn();
const mockNotifyWarning = jest.fn();
let mockUserId: string | null = "user_alice";

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({
    isLoaded: true,
    isSignedIn: mockUserId !== null,
    user: mockUserId ? { id: mockUserId, username: null, imageUrl: null } : null,
  }),
}));

// the editor imports its stylesheet (plan 413); Jest has no CSS transform
jest.mock("~/styles/wiki-os/editors.css", () => ({}));
jest.mock("~/styles/wiki-os/mediawiki-editors.css", () => ({}));
jest.mock("~/hooks/useNavigationScroll", () => ({
  useNavigationScroll: () => ({ repulsionProgress: 0 }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({
    success: jest.fn(),
    error: (...args: unknown[]) => mockNotifyError(...args),
    warning: (...args: unknown[]) => mockNotifyWarning(...args),
  }),
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
  WikiVisualToolbar: (props: {
    isDirty: boolean;
    handleSaveDraft: () => void;
    onSwitchToSource: () => void;
  }) => (
    <div data-testid="toolbar" data-dirty={String(props.isDirty)}>
      <button onClick={props.handleSaveDraft}>save-draft</button>
      <button onClick={props.onSwitchToSource}>to-source</button>
    </div>
  ),
}));
// the save panel's button publishes (the toolbar has none)
jest.mock("~/components/wiki-os/editor/components/WikiEditorSavePanel", () => ({
  WikiEditorSavePanel: (props: { onSave: () => void }) => (
    <button onClick={props.onSave}>publish</button>
  ),
}));
jest.mock("~/components/wiki-os/editor/components/WikiEditorModalHost", () => ({
  WikiEditorModalHost: () => null,
}));
jest.mock("~/components/wiki-os/editor/components/WikiEditorStatusBar", () => ({
  WikiEditorStatusBar: () => null,
}));
jest.mock("~/components/wiki-os/editor/plate/PlateWikiEditor", () => ({
  PlateWikiEditor: (props: {
    initialWikitext?: string;
    onEditorReady: (editor: unknown) => void;
    onValueChange: (nodes: unknown[], html: string, text: string) => void;
  }) => {
    React.useEffect(() => {
      props.onEditorReady({});
      reportValue = (nodes) =>
        props.onValueChange(nodes, "<p>html that must never be saved</p>", "");
      props.onValueChange(mockNodes, "<p>html that must never be saved</p>", "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="canvas">{props.initialWikitext}</div>;
  },
}));

const paragraph = (text: string) => ({ type: "p", children: [{ text }] });

const setup = (props: Partial<React.ComponentProps<typeof WikiVisualEditor>> = {}) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(
    <WikiVisualEditor
      title="Vesperia"
      initialWikitext="Start"
      onSave={onSave}
      onCancel={jest.fn()}
      onSwitchToSource={jest.fn()}
      {...props}
    />
  );
  return { onSave };
};

describe("WikiVisualEditor drafts and what a save writes (review fixes 7-8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.clear();
    mockUserId = "user_alice";
    mockNodes = [paragraph("Edited text.")];
  });

  it("does not write a draft after a successful publish", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await act(async () => undefined);
    expect(onSave).toHaveBeenCalledWith("Edited text.", "", false, false);
    expect(getDraft("user_alice", "Vesperia")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("keeps the work as a draft when the publish fails", async () => {
    const { onSave } = setup();
    onSave.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(getDraft("user_alice", "Vesperia")?.wikitext).toBe("Edited text."));
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
    await waitFor(() => expect(getDraft("user_alice", "Vesperia")).not.toBeNull());
    const draft = getDraft("user_alice", "Vesperia")!;
    expect(draft.wikitext).toBe("Edited text.");
    expect(draft.html).toBeUndefined();
    expect(draft.mode).toBe("visual");
  });

  it("keeps no draft for a signed-out editor and says why (plan 416)", async () => {
    mockUserId = null;
    setup();
    fireEvent.click(screen.getByText("save-draft"));
    await waitFor(() =>
      expect(mockNotifyError).toHaveBeenCalledWith("Sign in to save a draft", expect.any(String))
    );
    expect(window.localStorage.length).toBe(0);
  });

  it("does not start from another user's draft (plan 416)", () => {
    saveDraft("user_bob", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "visual",
      wikitext: "Bob's draft",
    });
    setup();
    expect(screen.getByTestId("canvas").textContent).toBe("Start");
  });

  it("starts from a local draft by default and ignores it when the host settles drafts itself", () => {
    saveDraft("user_alice", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "visual",
      wikitext: "From the draft",
    });
    setup();
    expect(screen.getByTestId("canvas").textContent).toBe("From the draft");
  });

  it("does not start from a draft when restoreLocalDraft is false", () => {
    saveDraft("user_alice", {
      title: "Vesperia",
      source: "ixwiki",
      mode: "visual",
      wikitext: "From the draft",
    });
    setup({ restoreLocalDraft: false });
    expect(screen.getByTestId("canvas").textContent).toBe("Start");
  });

  it("hands the host a reader of the editor's content, and withdraws it on unmount", () => {
    const register = jest.fn();
    const view = render(
      <WikiVisualEditor
        title="Vesperia"
        initialWikitext="Start"
        onSave={jest.fn()}
        onCancel={jest.fn()}
        onSwitchToSource={jest.fn()}
        registerContentReader={register}
      />
    );
    const reader = register.mock.calls[0]![0] as () => string | null;
    expect(reader()).toBe("Edited text.");
    view.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });

  it("tells the author when an edit could not be applied or a block was moved, and still saves", async () => {
    mockNodes = [
      { type: "p", children: [{ text: "Inserted above the redirect." }] },
      {
        type: "raw-wikitext",
        construct: "redirect",
        rawWikitext: "#REDIRECT [[Target]]",
        children: [{ text: "" }],
      },
      {
        type: "template-block",
        templateName: "Infobox x",
        params: { a: "9" },
        edited: true,
        parseState: "incomplete",
        rawWikitext: "{{Infobox x\n| a = 1",
        children: [{ text: "" }],
      },
    ];
    const { onSave } = setup();
    fireEvent.click(screen.getByText("publish"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(onSave.mock.calls[0]![0].startsWith("#REDIRECT [[Target]]")).toBe(true);
    const messages = mockNotifyWarning.mock.calls.map((call) => call[1] as string);
    expect(messages.some((m) => /#REDIRECT/.test(m))).toBe(true);
    expect(messages.some((m) => /not closed/.test(m))).toBe(true);
  });

  describe("dirty state (F2: the mount report is not an edit)", () => {
    const dirty = () => screen.getByTestId("toolbar").getAttribute("data-dirty");

    it("is clean when the canvas has only reported the document it opened", () => {
      setup();
      expect(dirty()).toBe("false");
    });

    it("becomes dirty when a later report differs from the opened document", () => {
      setup();
      act(() => reportValue([paragraph("Edited text, and more.")]));
      expect(dirty()).toBe("true");
    });

    it("stays clean when a later report serializes to the opened text", () => {
      setup();
      act(() => reportValue([paragraph("Edited text.")]));
      expect(dirty()).toBe("false");
    });

    it("does not report the mere opening of the visual editor as unsaved work when switching to source", () => {
      const onSwitchToSource = jest.fn();
      setup({ onSwitchToSource });
      fireEvent.click(screen.getByText("to-source"));
      expect(onSwitchToSource).toHaveBeenCalledWith(false, "Edited text.");
    });

    it("reports unsaved work when switching to source after an edit", () => {
      const onSwitchToSource = jest.fn();
      setup({ onSwitchToSource });
      act(() => reportValue([paragraph("Changed.")]));
      fireEvent.click(screen.getByText("to-source"));
      expect(onSwitchToSource).toHaveBeenCalledWith(true, "Changed.");
    });
  });
});
