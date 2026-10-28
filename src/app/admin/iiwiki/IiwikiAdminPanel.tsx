"use client";
// src/app/admin/iiwiki/IiwikiAdminPanel.tsx
// The IIWiki panel: the switch for every IIWiki request (and one per feature), the breaker, the live test, the
// config those requests use, and every place the app reaches IIWiki.

import { Globe, Network, Play, Refresh, Settings } from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Badge, type BadgeTone } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api, type RouterOutputs } from "~/trpc/react";

type Status = RouterOutputs["wikios"]["getIiwikiStatus"];
type ProbeRun = NonNullable<Status["lastProbe"]>;
type Verdict = ProbeRun["results"][number]["verdict"];
type FeatureId = Status["features"][number]["id"];

const VERDICTS: Record<Verdict, { label: string; tone: BadgeTone }> = {
  ok: { label: "OK", tone: "success" },
  "cloudflare-block": { label: "Blocked by Cloudflare", tone: "destructive" },
  "cloudflare-challenge": { label: "Cloudflare challenge", tone: "warning" },
  "rate-limited": { label: "Rate limited", tone: "warning" },
  "api-error": { label: "API error", tone: "warning" },
  "http-error": { label: "HTTP error", tone: "destructive" },
  timeout: { label: "Timed out", tone: "destructive" },
  network: { label: "Network error", tone: "destructive" },
  skipped: { label: "Skipped", tone: "default" },
};

/** One line for the whole run: every check ok, or the verdict most checks got. */
function runSummary(run: ProbeRun): { label: string; tone: BadgeTone } {
  const ran = run.results.filter((r) => r.verdict !== "skipped");
  if (ran.length > 0 && ran.every((r) => r.verdict === "ok"))
    return { label: "IIWiki answers", tone: "success" };
  const counts = new Map<Verdict, number>();
  for (const r of ran) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? VERDICTS[top[0]] : VERDICTS.skipped;
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Globe;
  title: string;
  hint: string;
}) {
  return (
    <div className="border-separator flex items-center gap-2 border-b pb-3">
      <Icon className="text-tint h-4 w-4" />
      <div>
        <h3 className="text-label text-caption">{title}</h3>
        <p className="text-label-secondary text-footnote">{hint}</p>
      </div>
    </div>
  );
}

function circuitLine(circuit: Status["circuit"]): string {
  if (circuit.state === "closed") {
    return circuit.failures > 0 ? `Closed, ${circuit.failures} failures in a row` : "Closed";
  }
  const seconds = Math.ceil(circuit.retryInMs / 1000);
  return circuit.state === "probing"
    ? "Open, one test request out now"
    : `Open after ${circuit.failures} failures; next try in ${seconds} s`;
}

function StatusSection({ status }: { status: Status }) {
  const utils = api.useUtils();
  const test = api.wikios.runIiwikiLiveTest.useMutation({
    onSuccess: () => void utils.wikios.getIiwikiStatus.invalidate(),
  });
  const reset = api.wikios.resetIiwikiCircuit.useMutation({
    onSuccess: () => void utils.wikios.getIiwikiStatus.invalidate(),
  });
  const run = test.data ?? status.lastProbe;
  const summary = run ? runSummary(run) : null;

  return (
    <Card padding="lg" className="space-y-4">
      <SectionTitle
        icon={Network}
        title="Status"
        hint="The live test and the breaker in this server process"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {summary ? (
              <Badge variant={summary.tone}>{summary.label}</Badge>
            ) : (
              <Badge>Not tested yet</Badge>
            )}
            {run && (
              <span className="text-label-secondary text-footnote">
                Tested {new Date(run.ranAt).toLocaleString()}
                {run.cached ? " (the last run; tests are at most one per 20 s)" : ""}
              </span>
            )}
          </div>
          <p className="text-label text-body">Breaker: {circuitLine(status.circuit)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={reset.isPending || status.circuit.state === "closed"}
            onClick={() => reset.mutate()}
          >
            <Refresh /> Reset breaker
          </Button>
          <Button disabled={test.isPending} onClick={() => test.mutate()}>
            <Play /> {test.isPending ? "Testing…" : "Run live test"}
          </Button>
        </div>
      </div>
      {test.error && <p className="text-destructive text-footnote">{test.error.message}</p>}
      {run && <LiveTestTable run={run} />}
    </Card>
  );
}

function LiveTestTable({ run }: { run: ProbeRun }) {
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Check</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>HTTP</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.results.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="text-label">{r.label}</div>
                <div className="text-label-secondary text-caption">{r.features.join(", ")}</div>
              </TableCell>
              <TableCell>
                <Badge variant={VERDICTS[r.verdict].tone}>{VERDICTS[r.verdict].label}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{r.status ?? ""}</TableCell>
              <TableCell className="tabular-nums">{r.ms === null ? "" : `${r.ms} ms`}</TableCell>
              <TableCell className="text-label-secondary text-footnote">
                {r.detail}
                {r.cfRay ? ` (Ray ${r.cfRay})` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-label-secondary text-footnote">
        Sent straight to {run.directApiUrl} as {run.userAgent}, past the breaker and the switch.
      </p>
    </div>
  );
}

function SwitchesSection({ status }: { status: Status }) {
  const utils = api.useUtils();
  const save = api.wikios.setIiwikiSwitch.useMutation({
    onSuccess: () => void utils.wikios.getIiwikiStatus.invalidate(),
  });
  const state = save.variables ?? status.switch;
  const flip = (enabled: boolean, feature?: FeatureId) =>
    save.mutate(
      feature
        ? { enabled: state.enabled, features: { ...state.features, [feature]: enabled } }
        : { enabled, features: state.features }
    );

  return (
    <Card padding="lg" className="space-y-4">
      <SectionTitle
        icon={Settings}
        title="Switches"
        hint="Off sends no request; readers see IIWiki as unavailable. Audited and sent to you on Discord."
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-label text-body">All IIWiki requests</p>
          <p className="text-label-secondary text-footnote">
            {state.enabled
              ? "On: each feature below follows its own switch."
              : "Off: no request goes to IIWiki."}
          </p>
        </div>
        <Switch
          aria-label="All IIWiki requests"
          checked={state.enabled}
          disabled={save.isPending}
          onCheckedChange={(next) => flip(next)}
        />
      </div>
      <div className="border-separator divide-separator divide-y border-t">
        {status.features.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-4 py-2">
            <p className={state.enabled ? "text-label text-body" : "text-label-tertiary text-body"}>
              {f.label}
            </p>
            <Switch
              aria-label={f.label}
              checked={state.features[f.id]}
              disabled={save.isPending || !state.enabled}
              onCheckedChange={(next) => flip(next, f.id)}
            />
          </div>
        ))}
      </div>
      {save.error && <p className="text-destructive text-footnote">{save.error.message}</p>}
    </Card>
  );
}

function ConfigSection({ config }: { config: Status["config"] }) {
  const rows: [string, string][] = [
    ["IIWiki", config.origin],
    ["api.php", config.directApiUrl],
    [
      "The app calls",
      config.viaRelay ? `${config.appApiUrl} (the development relay)` : config.appApiUrl,
    ],
    ["User agent", config.userAgent],
    ["Limits", `${config.limits.maxConcurrent} at once, ${config.limits.perMinute} a minute`],
    [
      "Proxy limits",
      `${config.limits.proxyMaxConcurrent} at once, ${config.limits.proxyPerMinute} a minute`,
    ],
  ];
  return (
    <Card padding="lg" className="space-y-4">
      <SectionTitle
        icon={Globe}
        title="Configuration"
        hint="What every IIWiki request uses; set in code"
      />
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-label-secondary text-footnote">{term}</dt>
            <dd className="text-label text-footnote break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function TouchpointsSection({ status }: { status: Status }) {
  const featureOn = (id: FeatureId) => status.switch.enabled && status.switch.features[id];
  return (
    <Card padding="lg" className="space-y-4">
      <SectionTitle
        icon={Network}
        title="Where the app reaches IIWiki"
        hint={`${status.touchpoints.length} places, each behind the switch of its feature`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>What</TableHead>
            <TableHead>Feature</TableHead>
            <TableHead>Gate</TableHead>
            <TableHead>Caching</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status.touchpoints.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="text-label">{t.label}</div>
                <div className="text-label-secondary text-caption break-all">{t.file}</div>
              </TableCell>
              <TableCell>
                <Badge variant={featureOn(t.feature) ? "success" : "default"}>
                  {t.feature} {featureOn(t.feature) ? "on" : "off"}
                </Badge>
              </TableCell>
              <TableCell className="text-footnote">
                {t.gate === "none" ? `${t.kind}, no request` : t.gate}
              </TableCell>
              <TableCell className="text-label-secondary text-footnote">{t.cache}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function IiwikiAdminPanel() {
  usePageTitle({ title: "Admin - IIWiki" });
  const {
    data: status,
    isLoading,
    error,
  } = api.wikios.getIiwikiStatus.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="IIWiki" />
      {error && (
        <Signal tone="destructive" title="The status could not be read">
          {error.message}
        </Signal>
      )}
      {isLoading || !status ? (
        <Skeleton className="rounded-row h-40 w-full" />
      ) : (
        <>
          <StatusSection status={status} />
          <SwitchesSection status={status} />
          <ConfigSection config={status.config} />
          <TouchpointsSection status={status} />
        </>
      )}
    </div>
  );
}
