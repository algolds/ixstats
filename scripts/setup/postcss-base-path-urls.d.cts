import type { PluginCreator } from "postcss";

/** The PostCSS pass that puts the base path in front of the stylesheets' `url("/fonts/…")` (see the .cjs). */
declare const plugin: PluginCreator<{ basePath?: string }>;
export = plugin;
