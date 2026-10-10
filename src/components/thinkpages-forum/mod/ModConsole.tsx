"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Book,
  ChatBubbleQuestion,
  Group,
  ShieldCheck,
  UserXmark,
  WarningTriangle,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FORUM_HOME, modHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { SignInLink } from "../BanNotice";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { ForumPage } from "../shell";
import { AppealsPanel } from "./AppealsPanel";
import { BansPanel } from "./BansPanel";
import { ModeratorsPanel } from "./ModeratorsPanel";
import { ModLogPanel } from "./ModLogPanel";
import type { ModContext, PanelProps } from "./ModRow";
import { ModScopeFilter, scopeRealms } from "./ModScopeFilter";
import { ReportQueue } from "./ReportQueue";
import { WarningsPanel } from "./WarningsPanel";

type Panel = (props: PanelProps) => ReactNode;

const TABS: ReadonlyArray<{
  value: string;
  label: string;
  icon: ReactNode;
  Panel: Panel;
  adminOnly?: boolean;
}> = [
  { value: "queue", label: "Queue", icon: <ShieldCheck />, Panel: ReportQueue },
  { value: "warnings", label: "Warnings", icon: <WarningTriangle />, Panel: WarningsPanel },
  { value: "bans", label: "Bans", icon: <UserXmark />, Panel: BansPanel },
  { value: "appeals", label: "Appeals", icon: <ChatBubbleQuestion />, Panel: AppealsPanel },
  { value: "log", label: "Log", icon: <Book />, Panel: ModLogPanel },
  {
    value: "moderators",
    label: "Moderators",
    icon: <Group />,
    Panel: ModeratorsPanel,
    adminOnly: true,
  },
];

const DEFAULT_TAB = "queue";

interface ModConsoleProps {
  /** `?tab=`; an unknown or unavailable tab opens the queue. */
  tab?: string;
  /** `?realm=`; a realm outside the viewer's scope shows everything. */
  realm?: string;
  page: number;
}

function moderatesAnything(context: ModContext): boolean {
  return context.isSiteAdmin || context.realms.length > 0 || context.categories.length > 0;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the viewer moderates, as the header's facts line: "Site admin · 3 realms · 2 categories". */
function scopeFacts(context: ModContext): string {
  return [
    context.isSiteAdmin ? "Site admin" : null,
    context.realms.length > 0 ? count(context.realms.length, "realm", "realms") : null,
    context.categories.length > 0
      ? count(context.categories.length, "category", "categories")
      : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** The console's shell around a notice (signed out, or nothing to moderate). */
function ConsoleNotice({ children }: { children: ReactNode }) {
  return (
    <ForumPage title="Moderation">
      <Card>{children}</Card>
    </ForumPage>
  );
}

/** The moderation console at /thinkpages/mod: queue, warnings, bans, appeals, log and (site admins) moderators. */
export function ModConsole({ tab, realm, page }: ModConsoleProps) {
  const { data: context, isLoading, error, refetch } = api.thinkpagesForumMod.context.useQuery();
  if (isLoading) return <ForumPageSkeleton blocks={2} />;
  if (error?.data?.code === "UNAUTHORIZED") {
    return (
      <ConsoleNotice>
        <EmptyState
          title="Sign in to moderate"
          message="The moderation console is for signed-in moderators."
          action={<SignInLink />}
        />
      </ConsoleNotice>
    );
  }
  if (error || !context) {
    return (
      <ForumLoadError
        notFound={false}
        notFoundTitle="Moderation"
        notFoundMessage=""
        onRetry={() => void refetch()}
      />
    );
  }
  if (!moderatesAnything(context)) {
    return (
      <ConsoleNotice>
        <EmptyState
          title="You don't moderate anything"
          message="Realm founders, their forum officers, category moderators and site admins see the moderation console."
          action={
            <Button asChild variant="secondary">
              <Link href={FORUM_HOME}>Back to the forum</Link>
            </Button>
          }
        />
      </ConsoleNotice>
    );
  }
  return <ConsoleTabs context={context} tab={tab} realm={realm} page={page} />;
}

function ConsoleTabs({ context, tab, realm, page }: ModConsoleProps & { context: ModContext }) {
  const router = useRouter();
  const tabs = TABS.filter((t) => !t.adminOnly || context.isSiteAdmin);
  const active = tabs.find((t) => t.value === tab)?.value ?? DEFAULT_TAB;
  const realms = scopeRealms(context);
  const scope = realms.some((r) => r.slug === realm) ? realm : undefined;
  const hrefFor = (nextTab: string, nextRealm: string | undefined) =>
    modHref({ tab: nextTab === DEFAULT_TAB ? undefined : nextTab, realm: nextRealm });
  const basePath = hrefFor(active, scope);

  return (
    <ForumPage
      title="Moderation"
      breadcrumbs={<p className="tabular-nums">{scopeFacts(context)}</p>}
      back={{ href: FORUM_HOME, label: "ThinkPages" }}
      wideActions={
        active === "moderators" ? null : (
          <ModScopeFilter
            realms={realms}
            value={scope}
            onChange={(next) => router.replace(hrefFor(active, next))}
          />
        )
      }
    >
      <Tabs value={active} onValueChange={(next) => router.replace(hrefFor(next, scope))}>
        <TabsList className="max-w-full gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <span aria-hidden className="text-tint inline-flex [&_svg]:size-4">
                {t.icon}
              </span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ value, Panel }) => (
          <TabsContent key={value} value={value} className="pt-3">
            <Panel context={context} realm={scope} page={page} basePath={basePath} />
          </TabsContent>
        ))}
      </Tabs>
    </ForumPage>
  );
}
