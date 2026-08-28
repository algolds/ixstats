"use client";
// src/components/shared/editor/EditorPlugins.tsx
// Core PlateJS plugin definitions for shared text editors.

import React from "react";
import { createPlatePlugin, ParagraphPlugin } from "platejs/react";

export const BoldPlugin = createPlatePlugin({
  key: "bold",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <strong {...attributes}>{children}</strong> },
});

export const ItalicPlugin = createPlatePlugin({
  key: "italic",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <em {...attributes}>{children}</em> },
});

export const UnderlinePlugin = createPlatePlugin({
  key: "underline",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <u {...attributes}>{children}</u> },
});

export const UnorderedListPlugin = createPlatePlugin({
  key: "ul",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <ul {...attributes} className="my-1 list-disc space-y-0.5 pl-5 text-slate-200">
        {children}
      </ul>
    ),
  },
});

export const OrderedListPlugin = createPlatePlugin({
  key: "ol",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <ol {...attributes} className="my-1 list-decimal space-y-0.5 pl-5 text-slate-200">
        {children}
      </ol>
    ),
  },
});

export const ListItemPlugin = createPlatePlugin({
  key: "li",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <li {...attributes} className="text-sm">
        {children}
      </li>
    ),
  },
});

export const LinkPlugin = createPlatePlugin({
  key: "link",
  node: { isElement: true, isInline: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <a
        {...attributes}
        href={element?.url as string | undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-400 underline transition-colors hover:text-blue-300"
      >
        {children}
      </a>
    ),
  },
});

export const WikiLinkPlugin = createPlatePlugin({
  key: "wikilink",
  node: { isElement: true, isInline: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <a
        {...attributes}
        href={`/wiki/${((element?.target as string) || "").replace(/ /g, "_")}`}
        className="font-semibold text-purple-400 underline transition-colors hover:text-purple-300"
      >
        {children}
      </a>
    ),
  },
});

export const WikiEmbedPlugin = createPlatePlugin({
  key: "wikiembed",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <div
        {...attributes}
        className="my-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3"
      >
        <span className="text-xs font-bold text-purple-300">📖 {element?.title}</span>
        <p className="mt-1 text-xs text-slate-300">{element?.summary}</p>
        {children}
      </div>
    ),
  },
});

export const ImagePlugin = createPlatePlugin({
  key: "img",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <div {...attributes} className="my-2 overflow-hidden rounded-lg">
        <img src={element?.src} alt={element?.alt || ""} className="max-h-64 w-auto object-cover" />
        {children}
      </div>
    ),
  },
});

export const EDITOR_PLUGINS = [
  ParagraphPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  UnorderedListPlugin,
  OrderedListPlugin,
  ListItemPlugin,
  LinkPlugin,
  WikiLinkPlugin,
  WikiEmbedPlugin,
  ImagePlugin,
];
