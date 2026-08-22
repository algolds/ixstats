import { Skeleton } from "~/components/ui/skeleton";
import { Backlight } from "~/components/ui/backlight";

export function SettingsSkeleton() {
  return (
    <div className="relative flex min-h-full w-full flex-1 flex-col">
      <Backlight blur={60} className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="relative h-full w-full">
          <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10" />
          <div className="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/5 dark:bg-blue-500/10" />
        </div>
      </Backlight>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded-lg" />
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/50 bg-white/30 p-2 pr-6 backdrop-blur-md dark:border-slate-800/30 dark:bg-slate-900/30">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Content Area Skeletons */}
          <div className="space-y-8 lg:col-span-8">
            {/* Account Information Card Skeleton */}
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="space-y-6 rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-6 w-48 rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-32 rounded-lg" />
                  </div>
                  <div className="space-y-2 rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-32 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>

            {/* Country Information Card Skeleton */}
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="space-y-6 rounded-[calc(1.5rem-1px)] bg-white/40 p-8 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-6 w-52 rounded-lg" />
                </div>
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <Skeleton className="h-32 w-48 rounded-2xl" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-3/4 rounded-lg" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-5 w-28 rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-5 w-28 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links Sidebar Skeletons */}
          <div className="space-y-6 lg:col-span-4">
            <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
              <div className="space-y-4 rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-36 rounded" />
                </div>

                {/* 6 Quick link buttons skeletonized */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-slate-50/50 p-3.5 dark:bg-slate-800/30"
                  >
                    <div className="flex w-full items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                    </div>
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
