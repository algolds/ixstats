"use client";

import React, { useState } from "react";
import { Scissors, Merge, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface SplitDialogProps {
  type: "split";
  featureName: string;
  onConfirm: (nameA: string, nameB: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

interface MergeDialogProps {
  type: "merge";
  featureNames: string[];
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

type SplitMergeDialogProps = SplitDialogProps | MergeDialogProps;

export const SplitMergeDialog = React.memo(function SplitMergeDialog(props: SplitMergeDialogProps) {
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [newName, setNewName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.type === "split") {
      if (nameA.trim() && nameB.trim()) {
        props.onConfirm(nameA.trim(), nameB.trim());
      }
    } else {
      if (newName.trim()) {
        props.onConfirm(newName.trim());
      }
    }
  };

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="border-border bg-card w-full max-w-md rounded-xl border p-5 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {props.type === "split" ? (
              <Scissors className="h-5 w-5 text-amber-400" />
            ) : (
              <Merge className="h-5 w-5 text-blue-400" />
            )}
            <h3 className="text-foreground text-lg font-semibold">
              {props.type === "split" ? "Split Country" : "Merge Countries"}
            </h3>
          </div>
          <button
            onClick={props.onCancel}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {props.type === "split" ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Splitting <span className="text-foreground font-medium">{props.featureName}</span>{" "}
                into two new countries.
              </p>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  First country name
                </label>
                <Input
                  value={nameA}
                  onChange={(e) => setNameA(e.target.value)}
                  placeholder="e.g., North Housatonic"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Second country name
                </label>
                <Input
                  value={nameB}
                  onChange={(e) => setNameB(e.target.value)}
                  placeholder="e.g., South Housatonic"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Merging{" "}
                <span className="text-foreground font-medium">{props.featureNames.join(", ")}</span>{" "}
                into a single country.
              </p>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  New country name
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Greater Housatonic"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            {props.type === "split"
              ? "This permanently replaces the original country with two new ones. It cannot be undone."
              : "This permanently merges the selected countries into one. It cannot be undone."}
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={props.onCancel}
              disabled={props.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                props.isLoading ||
                (props.type === "split" ? !nameA.trim() || !nameB.trim() : !newName.trim())
              }
            >
              {props.isLoading ? (
                "Processing..."
              ) : props.type === "split" ? (
                <>
                  <Scissors className="h-4 w-4" />
                  Split
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4" />
                  Merge
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
