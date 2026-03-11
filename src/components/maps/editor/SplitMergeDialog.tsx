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

export const SplitMergeDialog = React.memo(function SplitMergeDialog(
  props: SplitMergeDialogProps
) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {props.type === "split" ? (
              <Scissors className="h-5 w-5 text-amber-400" />
            ) : (
              <Merge className="h-5 w-5 text-blue-400" />
            )}
            <h3 className="text-lg font-semibold text-foreground">
              {props.type === "split" ? "Split Country" : "Merge Countries"}
            </h3>
          </div>
          <button
            onClick={props.onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {props.type === "split" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Splitting <span className="font-medium text-foreground">{props.featureName}</span> into two new countries.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                Merging{" "}
                <span className="font-medium text-foreground">
                  {props.featureNames.join(", ")}
                </span>{" "}
                into a single country.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
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
          <div className="mt-5 flex justify-end gap-2">
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
                (props.type === "split"
                  ? !nameA.trim() || !nameB.trim()
                  : !newName.trim())
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
