import Link from "next/link";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            <span className="text-[hsl(280,100%,70%)]">IxStats™</span>
          </h1>
          <p className="text-xl text-center max-w-2xl">
             Automated statistics for Ixnay Worldbuilding Community
          </p>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition-colors"
              href="/dashboard"
            >
              <h3 className="text-2xl font-bold">📊 IxStats Dashboard →</h3>
              <div className="text-lg">
                View and manage economic statistics for all countries. 
                Upload roster files and track growth over IxTime.
              </div>
            </Link>
            
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition-colors"
              href="/countries"
            >
              <h3 className="text-2xl font-bold">🌍 Countries →</h3>
              <div className="text-lg">
                Detailed view of individual countries, their statistics, 
                and historical data progression.
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-300 mb-2">
              Alpha version 0.8.8
            </p>
            <p className="text-xs text-gray-400">
              build version: 33240f2

            </p>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}