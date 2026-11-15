"use client";

import React, { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { DIPlugin } from "./types";

// Plugin Registry (external store for React 19 concurrency safety)

type Listener = () => void;

interface RegisteredPlugin {
  plugin: DIPlugin;
  token: symbol;
}

class DIPluginRegistry {
  private _plugins = new Map<string, RegisteredPlugin>();
  private _listeners = new Set<Listener>();
  private _snapshot: Map<string, DIPlugin> = new Map();

  get plugins() {
    return this._snapshot;
  }

  register(plugin: DIPlugin): symbol {
    const token = Symbol(plugin.id);
    this._plugins.set(plugin.id, { plugin, token });
    this._emitChange();
    return token;
  }

  unregister(id: string, token: symbol) {
    if (this._plugins.get(id)?.token !== token) return;
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
    const next = new Map<string, DIPlugin>();
    this._plugins.forEach((entry, id) => {
      next.set(id, entry.plugin);
    });
    this._snapshot = next;
    this._listeners.forEach((listener) => listener());
  }
}

// Context

const DIPluginContext = createContext<DIPluginRegistry | null>(null);

// Provider

export function DIPluginProvider({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => new DIPluginRegistry());

  return <DIPluginContext value={registry}>{children}</DIPluginContext>;
}

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
 *   accentColor: "var(--tint)",
 * });
 */
export function useDIPlugin<F = unknown, C = unknown>(plugin: DIPlugin<F, C>) {
  const registry = useContext(DIPluginContext);

  React.useEffect(() => {
    if (!registry) return;
    const token = registry.register(plugin as unknown as DIPlugin);
    return () => {
      registry.unregister(plugin.id, token);
    };
  }, [registry, plugin]);
}

/**
 * Get the currently active plugin (highest priority).
 * Returns null if no plugins are registered.
 */
export function useActiveDIPlugin(): DIPlugin | null {
  const registry = useContext(DIPluginContext);
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
