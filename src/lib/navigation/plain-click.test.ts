import { isPlainClick } from "./plain-click";

const click = (over: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...over,
});

it("takes over only a plain primary click", () => {
  expect(isPlainClick(click())).toBe(true);
  for (const over of [
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { defaultPrevented: true },
  ]) {
    expect(isPlainClick(click(over))).toBe(false);
  }
});
