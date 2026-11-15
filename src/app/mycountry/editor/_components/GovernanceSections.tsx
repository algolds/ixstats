"use client";

import { useState } from "react";
import { Bank, Community, Group } from "iconoir-react";
import { CabinetPanel } from "~/components/executive/politics/CabinetPanel";
import { LegislatureConfig } from "~/components/executive/politics/LegislatureConfig";
import { PartyManager } from "~/components/executive/politics/PartyManager";
import { EditorSection } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

export function LegislatureSection() {
  const { countryId } = useEditor();
  const [dirty, setDirty] = useState(false);
  useReportDirty("legislature", "Legislature", dirty);

  return (
    <EditorSection
      id="legislature"
      title="Legislature setup"
      description="Chambers, seat counts, electoral system, term lengths and election cycle."
      icon={<Bank />}
    >
      <LegislatureConfig countryId={countryId} embedded onDirtyChange={setDirty} />
    </EditorSection>
  );
}

export function CabinetSection() {
  const { countryId } = useEditor();

  return (
    <EditorSection
      id="cabinet"
      title="Cabinet"
      description="Appoint ministers and officials to lead your government's departments."
      icon={<Group />}
    >
      <CabinetPanel countryId={countryId} embedded />
    </EditorSection>
  );
}

export function PartiesSection() {
  const { countryId } = useEditor();

  return (
    <EditorSection
      id="parties"
      title="Political parties"
      description="Register political parties, set their ideology and starting electoral support."
      icon={<Community />}
    >
      <PartyManager countryId={countryId} embedded />
    </EditorSection>
  );
}
