import { focusedElement, refocus } from "~/lib/utils/focus";

describe("focusedElement and refocus", () => {
  afterEach(() => document.body.replaceChildren());

  it("names the focused element, and nothing while focus is on the page body", () => {
    expect(focusedElement()).toBeNull();
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    expect(focusedElement()).toBe(button);
  });

  it("gives focus back only to an element still on the page", () => {
    const button = document.createElement("button");
    document.body.append(button);
    refocus(button);
    expect(document.activeElement).toBe(button);
    const gone = document.createElement("button");
    const focus = jest.spyOn(gone, "focus");
    refocus(gone);
    refocus(null);
    expect(focus).not.toHaveBeenCalled();
  });
});
