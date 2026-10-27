"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { FacetShowcase } from "./_components/FacetShowcase";

export default function FacetMaterialsLabPage() {
  usePageTitle({ title: "Facet Materials Lab" });

  return (
    <div className="w-full space-y-6 pb-16">
      <PageHeader title="Facet materials lab" subtitle="Live samples of the production primitives." />
      <FacetShowcase />
    </div>
  );
}
