"use client";

import { useState } from "react";
import Link from "next/link";
import { EditPencil, Planet, Refresh } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { MapPipelinePanel } from "~/app/admin/realms/_components/map-pipeline/MapPipelinePanel";
import { ConfirmButton } from "./ConfirmButton";
import { JobDetailSheet } from "./JobDetailSheet";
import { JobsTable } from "./JobsTable";
import { RealmFigures } from "./RealmFigures";

const RECENT_JOBS = 10;

function RealmActions({
  realmId,
  slug,
  importId,
}: {
  realmId: string;
  slug: string;
  importId: string | null;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const refresh = () => {
    void utils.atlas.realms.invalidate();
    void utils.atlas.jobs.invalidate();
    void utils.geoCore.invalidate();
  };

  const rebuild = api.geoEditor.mapImport.rebuildRelief.useMutation({
    onSuccess: () => {
      notify.success("Relief rebuilt");
      refresh();
    },
    onError: (error) => notify.error("Could not rebuild the relief", error.message),
  });
  const rollback = api.atlas.jobs.rollback.useMutation({
    onSuccess: (result) => {
      notify.success(
        "Import rolled back",
        `${result.restored} borders restored, ${result.deleted} removed`
      );
      refresh();
    },
    onError: (error) => notify.error("Could not roll back", error.message),
  });
  const caches = api.atlas.realms.refresh.useMutation({
    onSuccess: ({ mapVersion }) => {
      notify.success("Caches refreshed", `The map is now at version ${mapVersion}`);
      refresh();
    },
    onError: (error) => notify.error("Could not refresh the caches", error.message),
  });

  return (
    <Card content="input" padding="md" className="flex flex-wrap items-center gap-3">
      <ConfirmButton
        label="Rebuild relief"
        title="Rebuild this realm's relief?"
        description="The shading of the land is built again from the realm's last world, or from its elevation bands. The map keeps its borders."
        keepLabel="Not now"
        disabled={rebuild.isPending}
        onConfirm={() => rebuild.mutate({ realmId })}
      />
      <ConfirmButton
        label="Roll back last import"
        title="Roll back the last import?"
        description="The borders it changed go back to how they were, the ones it created are removed, and the land areas it filled are cleared again."
        confirmLabel="Roll back"
        disabled={importId === null || rollback.isPending}
        onConfirm={() => {
          if (importId) rollback.mutate({ importId });
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={caches.isPending}
        onClick={() => caches.mutate({ realm: slug })}
      >
        <Refresh />
        Refresh caches
      </Button>
    </Card>
  );
}

function RecentJobs({ slug }: { slug: string }) {
  const [openJob, setOpenJob] = useState<string | null>(null);
  const { data } = api.atlas.jobs.list.useQuery(
    { realm: slug, limit: RECENT_JOBS },
    { retry: false }
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-3 text-label">Recent jobs</h2>
      <Card content="feed">
        {!data ? (
          <Skeleton className="h-24 w-full" />
        ) : data.jobs.length === 0 ? (
          <EmptyState
            compact
            title="No jobs yet"
            message="Imports and builds for this realm appear here."
          />
        ) : (
          <JobsTable jobs={data.jobs} onOpen={setOpenJob} showRealm={false} />
        )}
      </Card>
      <JobDetailSheet jobId={openJob} onClose={() => setOpenJob(null)} />
    </section>
  );
}

/** /admin/maps/realms/[slug]: one realm's figures, recent jobs, map pipeline and map actions. */
export function AtlasRealmPage({ slug }: { slug: string }) {
  usePageTitle({ title: "Admin - Atlas realm" });
  const { data, isLoading, error } = api.atlas.realms.get.useQuery(
    { realm: slug },
    { retry: false }
  );
  const links = (
    <>
      <Button asChild size="sm">
        <Link href={`/admin/maps/editor?realm=${encodeURIComponent(slug)}`}>
          <EditPencil />
          Open in editor
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/maps/studio?fit=${encodeURIComponent(slug)}`}>
          <Planet />
          Open in Studio
        </Link>
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.realm.name ?? slug}
        subtitle="Map figures, jobs and actions for this realm."
        back={{ href: "/admin/maps", label: "Atlas" }}
        actions={links}
      />
      {isLoading && <Skeleton className="rounded-card h-56 w-full" />}
      {error && (
        <Signal tone="destructive" title="This realm could not be read">
          {error.message}
        </Signal>
      )}
      {data && (
        <>
          <RealmFigures realm={data.realm} layerCounts={data.layerCounts} partial={data.partial} />
          <RealmActions
            realmId={data.realm.id}
            slug={data.realm.slug}
            importId={data.latestImport?.canRollBack ? data.latestImport.id : null}
          />
          <RecentJobs slug={data.realm.slug} />
          <section className="flex flex-col gap-3">
            <h2 className="text-title-3 text-label">Map pipeline</h2>
            <MapPipelinePanel slug={data.realm.slug} />
          </section>
        </>
      )}
    </div>
  );
}
