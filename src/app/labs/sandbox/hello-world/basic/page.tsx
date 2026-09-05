import Link from "next/link";

export default function BasicHelloWorldPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-base font-medium text-foreground">Hello world</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Barebones template container.
        </p>
        <div className="mt-4 pt-4 border-t border-border/60">
          <Link
            href="/labs/sandbox/hello-world"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
        </div>
      </div>
    </main>
  );
}
