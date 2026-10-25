"use client";

/**
 * The nation's declared terrain (realm time D3): an attacker's odds read the defender's terrain from the realm map;
 * where the map has no data for the nation, this declared profile stands in.
 */
import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TERRAIN_CLASSES,
  TERRAIN_LABELS,
  parseDeclaredTerrain,
  type TerrainClass,
} from "~/lib/military/combat";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

const NONE = "none";

export function DeclaredTerrainCard({ countryId }: { countryId: string }) {
  const { canEdit } = useCanEdit();
  const notify = useNotify();
  const utils = api.useUtils();
  const { data } = api.security.getDeclaredTerrain.useQuery({ countryId }, { enabled: canEdit });
  const declared = parseDeclaredTerrain(data?.terrainProfile);
  const [riverLine, setRiverLine] = useState<boolean | null>(null);
  const river = riverLine ?? declared?.riverLine ?? false;
  const save = api.security.setDeclaredTerrain.useMutation({
    onSuccess: () => void utils.security.getDeclaredTerrain.invalidate({ countryId }),
    onError: (error) => notify.error(`Could not save the terrain: ${error.message}`),
  });
  if (!canEdit) return null;

  const update = (terrain: TerrainClass | null, nextRiver: boolean) =>
    save.mutate({ countryId, terrain, riverLine: nextRiver });

  return (
    <Card variant="well" className="space-y-3 p-3">
      <div>
        <h4 className="text-label text-body font-medium">Declared terrain</h4>
        <p className="text-label-secondary text-footnote">
          Used for attacks on your nation where the realm map has no terrain data.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48">
          <Label>Terrain</Label>
          <Select
            value={declared?.terrain ?? NONE}
            onValueChange={(value) =>
              update(value === NONE ? null : (value as TerrainClass), river)
            }
            disabled={save.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not declared (typical mix)</SelectItem>
              {TERRAIN_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {TERRAIN_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="declared-river"
            checked={river}
            disabled={!declared || save.isPending}
            onCheckedChange={(checked) => {
              setRiverLine(checked);
              if (declared) update(declared.terrain, checked);
            }}
          />
          <Label htmlFor="declared-river">River line on the border</Label>
        </div>
      </div>
    </Card>
  );
}
