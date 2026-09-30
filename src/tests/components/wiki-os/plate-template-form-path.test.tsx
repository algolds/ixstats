import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlateInteractiveTemplateElement } from "~/components/wiki-os/editor/plate/elements/PlateInteractiveTemplateElement";
import { templateWikitext } from "~/components/wiki-os/editor/plate/wiki-structure-wikitext";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const mockSetNodes = jest.fn();
let mockElement: Record<string, unknown> = {};

jest.mock("slate", () => ({
  Transforms: {
    setNodes: (...args: unknown[]) => mockSetNodes(...args),
    removeNodes: jest.fn(),
  },
}));
jest.mock("platejs/react", () => ({
  useElement: () => mockElement,
  usePath: () => [0],
  useReadOnly: () => false,
  useEditorRef: () => ({}),
}));
jest.mock("~/components/wiki-os/editor/hooks/useTemplateSchema", () => ({
  useTemplateSchema: () => ({
    hasSchema: true,
    loading: false,
    paramList: [
      { key: "name", meta: { label: "Name" } },
      { key: "capital", meta: { label: "Capital" } },
    ],
  }),
}));

const SOURCE = "{{Infobox country\n| name = Urcea <!-- official -->\n| capital = [[Urceopolis]]\n| population = 54,000,000\n}}";

function renderElement() {
  const view = render(
    <PlateInteractiveTemplateElement attributes={{}}>
      <span />
    </PlateInteractiveTemplateElement>
  );
  fireEvent.click(screen.getByTitle("Edit template parameters"));
  return view;
}

describe("the template form (the shipped edit path) uses the selective rebuilder (item 5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElement = astToPlateNodes(wikitextToAst(SOURCE))[0] as Record<string, unknown>;
  });

  it("sets the changed params and the edited flag, and does not regenerate the template's wikitext", async () => {
    renderElement();
    fireEvent.change(await screen.findByLabelText("Capital"), { target: { value: "Vilena" } });

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    const [, props, options] = mockSetNodes.mock.calls[0]!;
    expect(props).toEqual({
      params: expect.objectContaining({ name: "Urcea <!-- official -->", capital: "Vilena", population: "54,000,000" }),
      edited: true,
    });
    expect(props).not.toHaveProperty("rawWikitext");
    expect(options).toEqual({ at: [0] });
  });

  it("is saved with only the changed value changed: order, spacing and comments of the rest survive", () => {
    renderElement();
    fireEvent.change(screen.getByLabelText("Capital"), { target: { value: "Vilena" } });
    const edited = { ...mockElement, ...mockSetNodes.mock.calls[0]![1] } as PlateNode;
    expect(templateWikitext(edited, "Infobox")).toBe(
      "{{Infobox country\n| name = Urcea <!-- official -->\n| capital = Vilena\n| population = 54,000,000\n}}"
    );
  });

  it("an edit that puts a | or }} in a value cannot break the template apart", () => {
    renderElement();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A|B }} C" } });
    const edited = { ...mockElement, ...mockSetNodes.mock.calls[0]![1] } as PlateNode;
    expect(templateWikitext(edited, "Infobox")).toBe(
      "{{Infobox country\n| name = A{{!}}B <nowiki>}}</nowiki> C <!-- official -->\n| capital = [[Urceopolis]]\n| population = 54,000,000\n}}"
    );
  });

  it("shows what will be saved on the Wikitext tab, and a typed raw edit ends the form's rebuilding", () => {
    mockElement = { ...mockElement, params: { ...(mockElement.params as object), capital: "Vilena" }, edited: true };
    renderElement();
    fireEvent.click(screen.getByText("Wikitext"));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("| capital = Vilena");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{{Infobox country|name=Typed}}" } });
    const props = mockSetNodes.mock.calls.at(-1)![1];
    expect(props).toMatchObject({ rawWikitext: "{{Infobox country|name=Typed}}", edited: false });
  });
});
