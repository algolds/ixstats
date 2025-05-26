import Link from "next/link";
import { BarChart3, Database, Clock, TrendingUp } from "lucide-react";

import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });

  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Ix<span className="text-[hsl(280,100%,70%)]">Stats</span>
          </h1>
          <p className="text-xl text-center max-w-2xl">
            Automated Economic Statistics System for the Ixnay Worldbuilding Community
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition-colors"
              href="/ixstats"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-[hsl(280,100%,70%)]" />
                <h3 className="text-2xl font-bold">IxStats Dashboard →</h3>
              </div>
              <div className="text-lg">
                View real-time economic statistics, import country data, and monitor growth trends in IxTime.
              </div>
            </Link>

            <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-[hsl(280,100%,70%)]" />
                <h3 className="text-2xl font-bold">Features</h3>
              </div>
              <div className="text-lg">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    IxTime Integration (4x Speed)
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Automated Growth Calculations
                  </li>
                  <li className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Excel Import/Export
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
          </div>

          <LatestPost />
        </div>
      </main>
    </HydrateClient>
  );
}