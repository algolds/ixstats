import { haloReducer, INITIAL_HALO_STATE } from "~/lib/halo/halo-state";

describe("haloReducer (src/lib/halo/halo-state)", () => {
  it("opens a view from compact and switches between views", () => {
    const search = haloReducer(INITIAL_HALO_STATE, { type: "open", view: "search" });
    expect(search).toEqual({ status: "expanded", view: "search" });

    const settings = haloReducer(search, { type: "open", view: "settings" });
    expect(settings).toEqual({ status: "expanded", view: "settings" });

    const closedViaOpenCompact = haloReducer(settings, { type: "open", view: "compact" });
    expect(closedViaOpenCompact).toEqual({ status: "compact" });
  });

  it("closes an expanded view to compact", () => {
    const open = haloReducer(INITIAL_HALO_STATE, { type: "open", view: "notifications" });
    expect(haloReducer(open, { type: "close" })).toEqual({ status: "compact" });
  });

  it("toggles the same view closed and toggles a different view open", () => {
    const opened = haloReducer(INITIAL_HALO_STATE, { type: "toggle", view: "settings" });
    expect(opened).toEqual({ status: "expanded", view: "settings" });

    const switched = haloReducer(opened, { type: "toggle", view: "search" });
    expect(switched).toEqual({ status: "expanded", view: "search" });

    const closed = haloReducer(switched, { type: "toggle", view: "search" });
    expect(closed).toEqual({ status: "compact" });
  });

  it("closes an open plugin view when a higher-priority plugin lacks that view (e.g. live sports during wiki)", () => {
    const wikiOpen = haloReducer(INITIAL_HALO_STATE, { type: "open", view: "plugin:wiki" });
    expect(wikiOpen).toEqual({ status: "expanded", view: "plugin:wiki" });

    const afterSportsLive = haloReducer(wikiOpen, {
      type: "plugin-changed",
      firstView: "sports-live",
      availableViews: ["sports-live"],
      pluginGone: false,
    });
    expect(afterSportsLive).toEqual({ status: "compact" });
  });

  it("keeps an open plugin view when the new plugin still provides it", () => {
    const narratorOpen = haloReducer(INITIAL_HALO_STATE, {
      type: "open",
      view: "plugin:narrator",
    });
    const stillProvided = haloReducer(narratorOpen, {
      type: "plugin-changed",
      firstView: "wiki",
      availableViews: ["wiki", "narrator"],
      pluginGone: false,
    });
    expect(stillProvided).toEqual({ status: "expanded", view: "plugin:narrator" });
  });

  it("closes an open plugin view when the plugin unmounts, while leaving builtin views open", () => {
    const pluginOpen = haloReducer(INITIAL_HALO_STATE, { type: "open", view: "plugin:wiki" });
    expect(
      haloReducer(pluginOpen, {
        type: "plugin-changed",
        firstView: null,
        pluginGone: true,
      })
    ).toEqual({ status: "compact" });

    const searchOpen = haloReducer(INITIAL_HALO_STATE, { type: "open", view: "search" });
    expect(
      haloReducer(searchOpen, {
        type: "plugin-changed",
        firstView: null,
        pluginGone: true,
      })
    ).toEqual({ status: "expanded", view: "search" });
  });
});
