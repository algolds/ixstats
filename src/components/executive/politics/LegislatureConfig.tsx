"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Landmark, Save, CheckCircle } from "lucide-react";
import { api } from "~/trpc/react";

interface LegislatureConfigProps {
  countryId: string;
}

export function LegislatureConfig({ countryId }: LegislatureConfigProps) {
  const [formData, setFormData] = useState({
    name: "National Assembly",
    chamberType: "unicameral" as "unicameral" | "bicameral",
    totalSeats: 100,
    electoralSystem: "proportional" as "proportional" | "fptp" | "mixed",
    termLength: 4,
    electionCycle: "fixed" as "fixed" | "variable",
  });
  const [saved, setSaved] = useState(false);

  const { data: legislature, refetch } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  useEffect(() => {
    if (legislature) {
      setFormData({
        name: legislature.name,
        chamberType: legislature.chamberType as "unicameral" | "bicameral",
        totalSeats: legislature.totalSeats,
        electoralSystem: legislature.electoralSystem as "proportional" | "fptp" | "mixed",
        termLength: legislature.termLength,
        electionCycle: (legislature.electionCycle as "fixed" | "variable") ?? "fixed",
      });
    }
  }, [legislature]);

  const configureLegislature = api.elections.configureLegislature.useMutation({
    onSuccess: () => {
      refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function handleSave() {
    const clampedSeats = Math.max(10, Math.min(1000, Number(formData.totalSeats) || 10));
    const clampedTerm = Math.max(1, Math.min(10, Number(formData.termLength) || 4));

    setFormData({ ...formData, totalSeats: clampedSeats, termLength: clampedTerm });
    configureLegislature.mutate({
      countryId,
      ...formData,
      totalSeats: clampedSeats,
      termLength: clampedTerm,
    });
  }

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-amber-600" />
          Legislature Configuration
        </CardTitle>
        <CardDescription>
          {legislature
            ? "Modify your parliament structure"
            : "Set up your nation's legislative body"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Legislature Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. National Assembly"
              />
            </div>
            <div>
              <Label>Chamber Type</Label>
              <Select
                value={formData.chamberType}
                onValueChange={(v) => setFormData({ ...formData, chamberType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unicameral">Unicameral (Single chamber)</SelectItem>
                  <SelectItem value="bicameral">Bicameral (Two chambers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Total Seats</Label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={formData.totalSeats}
                onChange={(e) => setFormData({ ...formData, totalSeats: e.target.value })}
              />
              <p className="text-muted-foreground mt-1 text-[10px]">10-1000 seats</p>
            </div>
            <div>
              <Label>Electoral System</Label>
              <Select
                value={formData.electoralSystem}
                onValueChange={(v) => setFormData({ ...formData, electoralSystem: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proportional">Proportional (D&apos;Hondt)</SelectItem>
                  <SelectItem value="fptp">First Past the Post</SelectItem>
                  <SelectItem value="mixed">Mixed (50/50)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Term Length (years)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={formData.termLength}
                onChange={(e) => setFormData({ ...formData, termLength: e.target.value })}
              />
            </div>
            <div>
              <Label>Election Cycle</Label>
              <Select
                value={formData.electionCycle}
                onValueChange={(v) => setFormData({ ...formData, electionCycle: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Term</SelectItem>
                  <SelectItem value="variable">Variable (snap elections)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-[10px]">
                Fixed = strict schedule; Variable = parliament may dissolve early
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={!formData.name || configureLegislature.isPending}
            size="sm"
            className="w-full gap-2"
          >
            {saved ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {legislature ? "Update Legislature" : "Create Legislature"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
