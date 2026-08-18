// src/components/defense/military/BranchHeader.tsx
"use client";

import React from "react";
import { Shield, Plus, Info, HelpCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface BranchHeaderProps {
  onCreateBranch: () => void;
}

/** Header card with title, help dialog, and "Add Branch" button. */
export const BranchHeader = React.memo(function BranchHeader({
  onCreateBranch,
}: BranchHeaderProps) {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              Military Forces Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-600" />
                      Military Forces Management Guide
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="mb-2 font-semibold">Creating Military Branches</h4>
                      <p className="text-muted-foreground">
                        Build your armed forces by creating branches (Army, Navy, Air Force, etc.).
                        Each branch can have custom names, mottos, and organizational structures
                        inspired by real-world militaries.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Branch Configuration</h4>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>
                          <strong>Personnel:</strong> Set active duty, reserve, and civilian staff
                          numbers
                        </li>
                        <li>
                          <strong>Budget:</strong> Allocate annual budget and percentage of total
                          defense spending
                        </li>
                        <li>
                          <strong>Readiness:</strong> Configure combat readiness, technology level,
                          training, and morale
                        </li>
                        <li>
                          <strong>Image/Emblem:</strong> Add custom branch insignia or emblems via
                          image URL
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Units &amp; Assets</h4>
                      <p className="text-muted-foreground">
                        Each branch can contain multiple units (divisions, regiments, squadrons) and
                        assets (vehicles, aircraft, ships, weapon systems). Browse the equipment
                        database to add assets from real-world systems.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Best Practices</h4>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>
                          Keep budget allocations realistic (total should equal 100% of branch
                          budget)
                        </li>
                        <li>
                          Balance readiness metrics - overly high values may not be sustainable
                        </li>
                        <li>Use established dates to track branch history and traditions</li>
                        <li>
                          Organize units hierarchically (e.g., Division &rarr; Brigade &rarr;
                          Battalion)
                        </li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </div>
          <Button onClick={onCreateBranch}>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
});
