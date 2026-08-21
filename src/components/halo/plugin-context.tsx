"use client";

import React, { createContext, useContext, useRef, useSyncExternalStore } from "react";
import type { DIPlugin, DIViewProps } from "./types";

// ── Plugin Registry (external store for React 19 concurrency safety) ──

type Listener = () => void;

class DIPluginRegistry {
  private _plugins = new Map<string, DIPlugin>();
  private _listeners = new Set<Listener>();
  private _snapshot: Map<string, DIPlugin> = new Map();

  get plugins() {
    return this._snapshot;
  }

  register(plugin: DIPlugin) {
    this._plugins.set(plugin.id, plugin);
    this._emitChange();
  }

  unregister(id: string) {
    this._plugins.delete(id);
    this._emitChange();
  }

  subscribe = (listener: Listener) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    return this._snapshot;
  };

  private _emitChange() {
    // Create a new Map reference so useSyncExternalStore detects the change
    this._snapshot = new Map(this._plugins);
    this._listeners.forEach((listener) => listener());
  }
}

// ── Context ──

interface DIPluginContextValue {
  registry: DIPluginRegistry;
}

const DIPluginContext = createContext<DIPluginContextValue | null>(null);

// ── Provider ──

export function DIPluginProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<DIPluginRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = new DIPluginRegistry();
  }

  return <DIPluginContext value={{ registry: registryRef.current }}>{children}</DIPluginContext>;
}

// ── Hooks ──

const EMPTY_PLUGINS_MAP: Map<string, DIPlugin> = new Map();
const DUMMY_SUBSCRIBE = () => () => {};
const DUMMY_SNAPSHOT = () => EMPTY_PLUGINS_MAP;

/**
 * Register a DI plugin for the lifetime of the calling component.
 * Call from any page/layout to inject content into the DI pill.
 *
 * @example
 * useDIPlugin({
 *   id: "wiki",
 *   priority: 10,
 *   center: <WikiBreadcrumb />,
 *   accentColor: "#3b82f6",
 * });
 */
export function useDIPlugin(plugin: DIPlugin) {
  const ctx = useContext(DIPluginContext);
  const registry = ctx?.registry;

  React.useEffect(() => {
    if (!registry) return;
    registry.register(plugin);
    return () => {
      registry.unregister(plugin.id);
    };
  }, [registry, plugin]);
}

/**
 * Get the currently active plugin (highest priority).
 * Returns null if no plugins are registered.
 */
export function useActiveDIPlugin(): DIPlugin | null {
  const ctx = useContext(DIPluginContext);
  const registry = ctx?.registry;
  const plugins = useSyncExternalStore(
    registry?.subscribe ?? DUMMY_SUBSCRIBE,
    registry?.getSnapshot ?? DUMMY_SNAPSHOT,
    registry?.getSnapshot ?? DUMMY_SNAPSHOT
  );

  if (!registry || plugins.size === 0) return null;

  // Find highest priority plugin
  let best: DIPlugin | null = null;
  const pluginArray = Array.from(plugins.values());
  for (let i = 0; i < pluginArray.length; i++) {
    const plugin = pluginArray[i]!;
    if (!best || (plugin.priority ?? 0) > (best.priority ?? 0)) {
      best = plugin;
    }
  }

  return best;
}

/**
 * Get all registered plugins (for rendering multiple badges, etc.)
 */
export function useAllDIPlugins(): DIPlugin[] {
  const ctx = useContext(DIPluginContext);
  const registry = ctx?.registry;
  const plugins = useSyncExternalStore(
    registry?.subscribe ?? DUMMY_SUBSCRIBE,
    registry?.getSnapshot ?? DUMMY_SNAPSHOT,
    registry?.getSnapshot ?? DUMMY_SNAPSHOT
  );

  if (!registry) return [];
  return Array.from(plugins.values());
}

/**
 * Look up a specific expanded view component from the active plugin.
 */
export function useDIPluginView(viewName: string): React.ComponentType<DIViewProps> | null {
  const plugin = useActiveDIPlugin();
  if (!plugin?.expandedViews) return null;
  return plugin.expandedViews[viewName] ?? null;
}
