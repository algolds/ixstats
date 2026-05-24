"use client";

import { useState } from "react";
import { useStudioState } from "../../context/StudioStateContext";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: "private", label: "Private", description: "Only you can access this realm" },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can view" },
  { value: "public", label: "Public", description: "Listed in the public realm directory" },
];

export function PublishSection() {
  const { state, dispatch, navigateTo } = useStudioState();
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [publishing, setPublishing] = useState(false);

  const handlePublish = () => {
    setPublishing(true);
    dispatch({ type: "COMPLETE_SECTION", section: "publish" });
    // Publish logic will be wired to tRPC later
    setTimeout(() => setPublishing(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Publish Your Realm</h1>
        <p className="mt-2 text-sm text-white/60">
          Name, describe, and share your generated world.
        </p>
      </div>

      {/* Name & Description */}
      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Realm Name</label>
          <input
            type="text"
            value={state.realmName}
            onChange={(e) => dispatch({ type: "SET_REALM_NAME", name: e.target.value })}
            placeholder="Enter a name for your world..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-rose-500/50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Description</label>
          <textarea
            value={state.realmDescription}
            onChange={(e) =>
              dispatch({ type: "SET_REALM_DESCRIPTION", description: e.target.value })
            }
            placeholder="Describe your world..."
            rows={4}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-rose-500/50"
          />
        </div>
      </div>

      {/* Visibility */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold text-white">Visibility</h2>
        <div className="space-y-3">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVisibility(opt.value)}
              className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                visibility === opt.value
                  ? "border-rose-500/50 bg-rose-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  visibility === opt.value ? "border-rose-500 bg-rose-500" : "border-white/30"
                }`}
              >
                {visibility === opt.value && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{opt.label}</p>
                <p className="text-xs text-white/40">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo("preview")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Preview
        </button>
        <button
          onClick={handlePublish}
          disabled={!state.realmName.trim() || publishing}
          className="rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-8 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-rose-500 hover:to-red-500 disabled:opacity-50"
        >
          {publishing ? "Publishing..." : "Publish Realm"}
        </button>
      </div>
    </div>
  );
}
