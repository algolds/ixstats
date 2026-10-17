"use client";
// src/app/admin/_components/platform/LorewardOverrideCard.tsx

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  SystemRestart as Loader2,
  ControlSlider as Sliders,
  FloppyDisk as Save,
} from "iconoir-react";
import { ValueSelect } from "~/components/ui/value-select";
import { overrideFields, overrideToast } from "~/lib/lorewards/override-form";

export function LorewardOverrideCard() {
  const notify = useNotify();

  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideType, setOverrideType] = useState<string>("daily");
  // A blank field keeps the stored value; only "No winner" or "No runner-up" empties a place
  const [overrideWinnerUser, setOverrideWinnerUser] = useState<string>("");
  const [overrideWinnerPage, setOverrideWinnerPage] = useState<string>("");
  const [overrideWinnerScore, setOverrideWinnerScore] = useState<string>("");
  const [overrideWinnerBytes, setOverrideWinnerBytes] = useState<string>("");
  const [overrideNoWinner, setOverrideNoWinner] = useState(false);
  const [overrideRunnerUpUser, setOverrideRunnerUpUser] = useState<string>("");
  const [overrideRunnerUpPage, setOverrideRunnerUpPage] = useState<string>("");
  const [overrideRunnerUpScore, setOverrideRunnerUpScore] = useState<string>("");
  const [overrideRunnerUpBytes, setOverrideRunnerUpBytes] = useState<string>("");
  const [overrideNoRunnerUp, setOverrideNoRunnerUp] = useState(false);

  const overrideWinnerMutation = api.lorewards.overrideWinner.useMutation({
    onSuccess: ({ trophies, botSynced }) => {
      const toast = overrideToast(botSynced, trophies);
      notify[toast.tone](toast.title, toast.message);
    },
    onError: (err) => {
      notify.error("Override failed", err.message);
    },
  });

  const handleOverrideSubmit = () => {
    if (!overrideDate) {
      notify.error("Validation error", "Please select a date for the override.");
      return;
    }
    overrideWinnerMutation.mutate({
      date: overrideDate,
      type: overrideType as "daily" | "weekly" | "monthly",
      ...overrideFields(
        {
          user: overrideWinnerUser,
          page: overrideWinnerPage,
          score: overrideWinnerScore,
          bytes: overrideWinnerBytes,
          cleared: overrideNoWinner,
        },
        {
          user: overrideRunnerUpUser,
          page: overrideRunnerUpPage,
          score: overrideRunnerUpScore,
          bytes: overrideRunnerUpBytes,
          cleared: overrideNoRunnerUp,
        }
      ),
    });
  };

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="text-title-3 flex items-center gap-2">
          <Sliders className="text-yellow h-5 w-5" />
          Manual winner override tool
        </CardTitle>
        <CardDescription>
          Manually rewrite the winning details of past daily, weekly, or monthly entries and push
          announcement updates to the Discord bot. A blank field keeps its stored value, except a
          new holder starts with no page or score. The place's trophy moves with the override. Any
          day of a weekly or monthly contest finds it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Date</label>
            <Input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Type</label>
            <ValueSelect
              value={overrideType}
              onValueChange={(v) => setOverrideType(v)}
              options={[
                ["daily", "Daily Loreward"],
                ["weekly", "Weekly Loreward"],
                ["monthly", "Monthly Loreward"],
              ]}
              size="sm"
              className="w-full"
            />
          </div>
        </div>

        <div className="border-separator space-y-2 border-t pt-2">
          <h4 className="text-label text-subhead font-semibold">Winner details</h4>
          <label className="text-label-secondary text-subhead flex items-center gap-2">
            <Switch checked={overrideNoWinner} onCheckedChange={setOverrideNoWinner} />
            No winner
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Username</label>
              <Input
                placeholder="Winner username"
                disabled={overrideNoWinner}
                value={overrideWinnerUser}
                onChange={(e) => setOverrideWinnerUser(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Page title</label>
              <Input
                placeholder="Winner article page"
                disabled={overrideNoWinner}
                value={overrideWinnerPage}
                onChange={(e) => setOverrideWinnerPage(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Score</label>
              <Input
                type="number"
                placeholder="Winner score"
                disabled={overrideNoWinner}
                value={overrideWinnerScore}
                onChange={(e) => setOverrideWinnerScore(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Bytes added</label>
              <Input
                type="number"
                placeholder="Winner bytes"
                disabled={overrideNoWinner}
                value={overrideWinnerBytes}
                onChange={(e) => setOverrideWinnerBytes(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>
          </div>
        </div>

        <div className="border-separator space-y-2 border-t pt-2">
          <h4 className="text-label text-subhead font-semibold">Runner-up details</h4>
          <label className="text-label-secondary text-subhead flex items-center gap-2">
            <Switch checked={overrideNoRunnerUp} onCheckedChange={setOverrideNoRunnerUp} />
            No runner-up
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Username</label>
              <Input
                placeholder="Runner-up username"
                disabled={overrideNoRunnerUp}
                value={overrideRunnerUpUser}
                onChange={(e) => setOverrideRunnerUpUser(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Page title</label>
              <Input
                placeholder="Runner-up article page"
                disabled={overrideNoRunnerUp}
                value={overrideRunnerUpPage}
                onChange={(e) => setOverrideRunnerUpPage(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Score</label>
              <Input
                type="number"
                placeholder="Runner-up score"
                disabled={overrideNoRunnerUp}
                value={overrideRunnerUpScore}
                onChange={(e) => setOverrideRunnerUpScore(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Bytes added</label>
              <Input
                type="number"
                placeholder="Runner-up bytes"
                disabled={overrideNoRunnerUp}
                value={overrideRunnerUpBytes}
                onChange={(e) => setOverrideRunnerUpBytes(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleOverrideSubmit}
          disabled={overrideWinnerMutation.isPending}
          className="w-full gap-2"
        >
          {overrideWinnerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save and sync winner override
        </Button>
      </CardContent>
    </Card>
  );
}
