import { Code2, ShieldCheck, Terminal } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox } from "../../_components/ArticleLayout";

export default function ApiArticle() {
  return (
    <ArticleLayout
      title="API & tRPC"
      description="Learn how the tRPC layer is structured and how to work with new or existing procedures."
      icon={Code2}
    >
      <Section title="Structure">
        <ul className="list-disc space-y-2 pl-6">
          <li>Routers live in `src/server/api/routers` (52 total, 580+ procedures).</li>
          <li>`src/server/api/trpc.ts` defines context, middleware, rate limiting, and shared helpers.</li>
          <li>Client hooks generated via `src/trpc/react.tsx` for use in React components.</li>
          <li>Rate limiting middleware with tiered limits (10-120 req/min) for security.</li>
        </ul>
      </Section>

      <Section title="Creating Procedures">
        <InfoBox title="Steps">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Add your procedure with Zod validation and auth/role guards as needed.</li>
            <li>Register the router in `src/server/api/root.ts`.</li>
            <li>
              Consume using <code>api.&lt;router&gt;.&lt;procedure&gt;</code> hooks.
            </li>
            <li>Document changes in `docs/reference/api-complete.md` and relevant help articles.</li>
          </ol>
        </InfoBox>
      </Section>

      <WarningBox title="Best Practices">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <ShieldCheck className="inline h-4 w-4" /> Use `protectedProcedure`/role checks for
            sensitive operations.
          </li>
          <li>
            <Terminal className="inline h-4 w-4" /> Add Jest coverage in
            `src/server/api/routers/__tests__` for complex logic.
          </li>
          <li>Run `npm run audit:wiring` to ensure new procedures are wired correctly.</li>
        </ul>
      </WarningBox>
    </ArticleLayout>
  );
}
