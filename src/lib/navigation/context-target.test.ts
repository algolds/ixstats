import { COUNTRY_ATTRS, countryProfilePath, resolveContextTarget } from "./context-target";

const mount = (html: string) => {
  document.body.innerHTML = html;
  return (selector: string) => document.querySelector(selector)!;
};

const rightClick = (target: EventTarget, over: Record<string, string | number | boolean> = {}) => ({
  target,
  button: 2,
  shiftKey: false,
  defaultPrevented: false,
  ...over,
});

const resolve = (target: EventTarget, over?: Record<string, string | number | boolean>) =>
  resolveContextTarget(rightClick(target, over), window.getSelection());

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

it("offers the page actions when nothing specific was hit", () => {
  const $ = mount("<main><p>Plain text</p></main>");
  expect(resolve($("p"))).toEqual({
    selection: null,
    link: null,
    anchor: null,
    country: null,
    image: null,
    areas: [],
    page: true,
  });
});

it("finds the link around the target and drops the page actions", () => {
  const $ = mount('<a href="/wiki/Alcairet"><span>Alcairet</span></a>');
  const target = resolve($("span"));
  expect(target).toMatchObject({
    link: "http://localhost/wiki/Alcairet",
    country: null,
    page: false,
  });
  expect(target?.anchor).toBe($("a"));
});

it("reads the nation off a country link", () => {
  const $ = mount(
    `<a href="/countries/alcairet" ${COUNTRY_ATTRS.id}="c1" ${COUNTRY_ATTRS.slug}="alcairet" ${COUNTRY_ATTRS.name}="Alcairet">Alcairet</a>`
  );
  expect(resolve($("a"))?.country).toEqual({ id: "c1", slug: "alcairet", name: "Alcairet" });
});

it("a country link known only by its slug is still a nation", () => {
  const $ = mount(`<a href="/countries/alcairet" ${COUNTRY_ATTRS.slug}="alcairet">Alcairet</a>`);
  expect(resolve($("a"))?.country).toEqual({ id: undefined, slug: "alcairet", name: undefined });
});

it("finds an image, alone or inside a link", () => {
  const $ = mount(
    '<img id="solo" src="/flag.png" /><a href="/x"><img id="linked" src="/y.png" /></a>'
  );
  expect(resolve($("#solo"))).toMatchObject({
    image: "http://localhost/flag.png",
    link: null,
    page: false,
  });
  expect(resolve($("#linked"))).toMatchObject({
    image: "http://localhost/y.png",
    link: "http://localhost/x",
  });
});

it("offers Copy only when the click lands on the selection", () => {
  const $ = mount('<p id="a">Selected words</p><p id="b">Elsewhere</p>');
  window.getSelection()!.selectAllChildren($("#a"));
  expect(resolve($("#a"))).toMatchObject({ selection: "Selected words", page: false });
  expect(resolve($("#b"))).toMatchObject({ selection: null, page: true });
});

it("resolves a text node target to its element", () => {
  const $ = mount('<a href="/x">text</a>');
  expect(resolve($("a").firstChild!)?.link).toBe("http://localhost/x");
});

it("lists the registered areas around the target, innermost first", () => {
  const $ = mount(
    '<section data-context-area="outer"><div data-context-area="inner"><p>Here</p></div></section>'
  );
  expect(resolve($("p"))?.areas).toEqual(["inner", "outer"]);
});

it.each([
  ["a text input", "<input />", "input"],
  ["a textarea", "<textarea></textarea>", "textarea"],
  ["a select", "<select></select>", "select"],
  ["an editor", '<div contenteditable="true"><p>Draft</p></div>', "p"],
  ["a canvas", "<canvas></canvas>", "canvas"],
  ["a MapLibre map", '<div class="maplibregl-map"><div id="t"></div></div>', "#t"],
  ["a video", "<video></video>", "video"],
  ["an open menu", '<div role="menu"><div role="menuitem">Item</div></div>', "[role=menuitem]"],
  ["a dialog", '<div role="dialog"><a href="/x">Link</a></div>', "a"],
  ["an opted-out subtree", '<div data-native-context-menu><a href="/x">Link</a></div>', "a"],
])("leaves the browser's menu on %s", (_name, html, selector) => {
  const $ = mount(html);
  expect(resolve($(selector))).toBeNull();
});

it("a map on a context surface takes the menu, about the surface rather than the page", () => {
  const $ = mount(
    '<div data-context-area="map" data-context-surface><div class="maplibregl-map"><canvas></canvas><input /></div></div>'
  );
  expect(resolve($("canvas"))).toMatchObject({ areas: ["map"], page: false });
  expect(resolve($("canvas"), { pointerType: "touch" })).not.toBeNull();
  expect(resolve($("canvas"), { defaultPrevented: true })).not.toBeNull();
  expect(resolve($("input"))).toBeNull();
});

it("a read-only island inside an editor is still part of the editor", () => {
  const $ = mount('<div contenteditable="true"><span contenteditable="false">chip</span></div>');
  expect(resolve($("span"))).toBeNull();
});

it("leaves the browser's menu on Shift+right-click, but not on the keyboard's Shift+F10", () => {
  const $ = mount('<a href="/x">Link</a>');
  expect(resolve($("a"), { shiftKey: true })).toBeNull();
  expect(resolve($("a"), { shiftKey: true, button: 0 })).not.toBeNull();
});

it("stands down when a feature's own context menu took the event", () => {
  const $ = mount('<a href="/x">Link</a>');
  expect(resolve($("a"), { defaultPrevented: true })).toBeNull();
});

it("a touch long-press takes over links and images, never plain text (it selects a word)", () => {
  const $ = mount('<p>Text</p><a href="/x">Link</a><img src="/y.png" />');
  expect(resolve($("p"), { pointerType: "touch" })).toBeNull();
  expect(resolve($("a"), { pointerType: "touch" })).not.toBeNull();
  expect(resolve($("img"), { pointerType: "touch" })).not.toBeNull();
});

it("builds a nation's profile path from its slug, else its id", () => {
  expect(countryProfilePath({ id: "c1", slug: "new alcairet" })).toBe("/countries/new%20alcairet");
  expect(countryProfilePath({ id: "c1" })).toBe("/countries/c1");
});
