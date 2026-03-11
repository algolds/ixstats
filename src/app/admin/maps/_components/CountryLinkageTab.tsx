"use client";

import { useState } from "react";
import { CountryAssigner } from "./CountryAssigner";
import { LinkageValidator } from "./LinkageValidator";

type SubTab = "assign" | "validate";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "assign", label: "Assignment" },
  { id: "validate", label: "Validation" },
];

export function CountryLinkageTab() {
  const [subTab, setSubTab] = useState<SubTab>("assign");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              subTab === tab.id
                ? "bg-blue-500/20 text-blue-400"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "assign" && <CountryAssigner />}
      {subTab === "validate" && <LinkageValidator />}
    </div>
  );
}
