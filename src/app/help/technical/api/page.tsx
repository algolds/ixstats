"use client";

import { Code2, ShieldCheck } from "lucide-react";
import { ArticleLayout, Section, InfoBox, WarningBox, ContentCard } from "../../_components/ArticleLayout";

export default function ApiArticle() {
  return (
    <ArticleLayout
      title="API & tRPC"
      description="Learn how the tRPC layer is structured and how to work with new or existing procedures."
      icon={Code2}
    >
      <ContentCard>
        <Section title="Structure">
          <ul className="list-disc space-y-2 pl-6">
            <li>61 tRPC routers providing 927 endpoints across all platform domains.</li>
            <li>Shared context, middleware, rate limiting, and helpers defined in the tRPC base configuration.</li>
            <li>Type-safe client hooks are auto-generated for use in React components.</li>
            <li>Rate limiting middleware with tiered limits (10-120 req/min) for security.</li>
          </ul>
        </Section>

        <Section title="Creating Procedures">
          <InfoBox title="Steps">
            <ol className="list-decimal space-y-1 pl-6">
              <li>Add your procedure with Zod validation and auth/role guards as needed.</li>
              <li>Register the router in the central app router.</li>
              <li>
                Consume using the auto-generated tRPC hooks (e.g., query or mutation hooks
                namespaced by router and procedure name).
              </li>
              <li>Document changes in the relevant help articles.</li>
            </ol>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <WarningBox title="Best Practices">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <ShieldCheck className="inline h-4 w-4" /> Use protected procedures and role checks for
              sensitive operations.
            </li>
            <li>
              Add test coverage for complex business logic in router procedures.
            </li>
          </ul>
        </WarningBox>
      </ContentCard>
    </ArticleLayout>
  );
}
