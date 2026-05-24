"use client";

import { useStudioState } from "../../context/StudioStateContext";

export function DashboardSection() {
  const { navigateTo } = useStudioState();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">World Studio</h1>
        <p className="mt-2 text-sm text-white/60">
          Create, configure, and publish procedurally generated worlds.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Create New Realm */}
        <button
          onClick={() => navigateTo("create")}
          className="group rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-600/10 p-6 text-left backdrop-blur-sm transition-all hover:border-violet-500/50 hover:from-violet-500/20 hover:to-purple-600/20"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/20 text-2xl transition-transform group-hover:scale-110">
            ✨
          </div>
          <h3 className="text-lg font-semibold text-white">Create New Realm</h3>
          <p className="mt-1 text-sm text-white/50">
            Start from a preset or upload your own map image.
          </p>
        </button>

        {/* Placeholder cards */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-2xl">
            📂
          </div>
          <h3 className="text-lg font-semibold text-white">Your Realms</h3>
          <p className="mt-1 text-sm text-white/40">
            No saved realms yet. Create one to get started.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 text-2xl">
            🌐
          </div>
          <h3 className="text-lg font-semibold text-white">Public Realms</h3>
          <p className="mt-1 text-sm text-white/40">Browse worlds published by the community.</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
        <p className="text-sm text-white/40">
          Your recent world generation activity will appear here.
        </p>
      </div>
    </div>
  );
}
