"use client";

import React, { useState } from "react";
import { Cut as Scissors, GitMerge as Merge, WarningTriangle } from "iconoir-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
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
    <Dialog open onOpenChange={(open) => !open && !props.isLoading && props.onCancel()}>
      <DialogContent className="rounded-card p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {props.type === "split" ? (
              <Scissors className="text-label-secondary h-5 w-5" aria-hidden />
            ) : (
              <Merge className="text-label-secondary h-5 w-5" aria-hidden />
            )}
            {props.type === "split" ? "Split country" : "Merge countries"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {props.type === "split" ? (
            <div className="space-y-3">
              <p className="text-label-secondary text-body">
                Splitting <span className="text-label font-medium">{props.featureName}</span> into
                two new countries.
              </p>
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
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
                <label className="text-label-secondary text-caption mb-1 block">
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
              <p className="text-label-secondary text-body">
                Merging{" "}
                <span className="text-label font-medium">{props.featureNames.join(", ")}</span> into
                a single country.
              </p>
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
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

          <p className="text-footnote text-yellow mt-3 flex items-start gap-2">
            <WarningTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
      </DialogContent>
    </Dialog>
  );
});
