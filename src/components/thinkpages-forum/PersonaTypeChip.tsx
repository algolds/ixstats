import { Community, Crown, Journal } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import type { PersonaType } from "~/lib/thinkpages-forum/persona-type";

const CHIP: Record<PersonaType, { label: string; Icon: typeof Crown }> = {
  government: { label: "Government", Icon: Crown },
  media: { label: "Media", Icon: Journal },
  citizen: { label: "Citizen", Icon: Community },
};

/** A persona's voice as a neutral chip: the app tint already carries the colour, so the chip stays quiet. */
export function PersonaTypeChip({ type }: { type: PersonaType }) {
  const { label, Icon } = CHIP[type];
  return (
    <Badge variant="default">
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
