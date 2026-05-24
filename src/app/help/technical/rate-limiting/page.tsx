"use client";

import Link from "next/link";
import { Shield, Zap, AlertCircle, Database } from "lucide-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function RateLimitingArticle() {
  return (
    <ArticleLayout
      title="Rate Limiting System"
      description="Understand how Redis-based rate limiting protects the platform from abuse while ensuring fair resource allocation across all users."
      icon={Shield}
    >
      <ContentCard>
        <Section title="Rate Limiting Overview">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Dual Backend:</strong> Redis (production) for distributed rate limiting,
              in-memory fallback (development).
            </li>
            <li>
              <strong>Tiered Limits:</strong> Different limits for different operation types (10-120
              req/min).
            </li>
            <li>
              <strong>Namespace Isolation:</strong> Separate rate limit buckets for reads, writes,
              admin, public operations.
            </li>
            <li>
              <strong>Automatic Failover:</strong> Falls back to in-memory store if Redis
              unavailable; maintains service continuity.
            </li>
          </ul>
        </Section>

        <Section title="Rate Limit Tiers">
          <InfoBox title="Operation Categories">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-left">Limit</th>
                  <th className="py-2 text-left">Examples</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2">Standard Reads</td>
                  <td className="py-2">100 req/min</td>
                  <td className="py-2">Country data, leaderboards, public lists</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2">Heavy Reads</td>
                  <td className="py-2">30 req/min</td>
                  <td className="py-2">Complex analytics, aggregations, reports</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2">Standard Writes</td>
                  <td className="py-2">60 req/min</td>
                  <td className="py-2">Profile updates, posts, comments</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2">Heavy Writes</td>
                  <td className="py-2">10 req/min</td>
                  <td className="py-2">Builder changes, bulk operations</td>
                </tr>
                <tr>
                  <td className="py-2">Admin Operations</td>
                  <td className="py-2">120 req/min</td>
                  <td className="py-2">Admin CMS, system management</td>
                </tr>
              </tbody>
            </table>
          </InfoBox>
        </Section>

        <Section title="How Rate Limiting Works">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Sliding Window:</strong> Tracks requests in rolling 60-second window for
              accurate rate measurement.
            </li>
            <li>
              <strong>User Identification:</strong> Uses Clerk user ID (authenticated) or IP address
              (anonymous).
            </li>
            <li>
              <strong>Namespace Keys:</strong>{" "}
              <code>ratelimit:&#123;namespace&#125;:&#123;userId&#125;</code> format for isolation.
            </li>
            <li>
              <strong>Redis Storage:</strong> Counter incremented per request; expires after window
              period.
            </li>
            <li>
              <strong>Response Headers:</strong> X-RateLimit-Limit, X-RateLimit-Remaining,
              X-RateLimit-Reset.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Security Benefits">
          <InfoBox title="Protection Layers">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>DDoS Prevention:</strong> Limits damage from distributed denial-of-service
                attacks.
              </li>
              <li>
                <strong>Brute Force Protection:</strong> Stops password guessing and credential
                stuffing.
              </li>
              <li>
                <strong>API Abuse Prevention:</strong> Prevents malicious actors from overwhelming
                system resources.
              </li>
              <li>
                <strong>Fair Resource Allocation:</strong> Ensures all users get reasonable platform
                access.
              </li>
              <li>
                <strong>Database Protection:</strong> Prevents database overload from excessive
                queries.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Rate Limit Exceeded (HTTP 429)">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              When limit exceeded, API returns <code>429 Too Many Requests</code> with retry
              information.
            </li>
            <li>
              <strong>Error Response:</strong>{" "}
              <code>&#123;"error": "Rate limit exceeded", "retryAfter": 45&#125;</code>
            </li>
            <li>
              <strong>Client Handling:</strong> Implement exponential backoff; respect
              X-RateLimit-Reset header.
            </li>
            <li>
              <strong>UI Feedback:</strong> Display user-friendly message with countdown timer.
            </li>
          </ul>
        </Section>

        <Section title="Configuration & Monitoring">
          <InfoBox title="Production Setup">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Redis Configuration:</strong> Redis connection configured via environment
                variables for production.
              </li>
              <li>
                <strong>Custom Limits:</strong> Default rate limits can be overridden via
                environment variables per endpoint category.
              </li>
              <li>
                <strong>Monitoring:</strong> Track rate limit hits, rejections, and Redis health via
                the admin analytics dashboard.
              </li>
              <li>
                <strong>Logging:</strong> Rate limit violations logged to audit trail with user ID,
                endpoint, timestamp.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <WarningBox title="Best Practices">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Zap className="inline h-4 w-4" /> Implement client-side throttling to avoid hitting
              limits unnecessarily.
            </li>
            <li>
              <AlertCircle className="inline h-4 w-4" /> Cache frequently accessed data to reduce
              API calls.
            </li>
            <li>
              <Database className="inline h-4 w-4" /> Use batch operations where possible to stay
              within limits.
            </li>
            <li>
              Monitor rate limit headers to track usage and adjust client behavior proactively.
            </li>
          </ul>
        </WarningBox>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link
                href="/help/technical/api"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                API & tRPC
              </Link>{" "}
              — How rate limiting integrates with the API layer.
            </li>
            <li>
              <Link
                href="/help/technical/architecture"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                System Architecture
              </Link>{" "}
              — Overall platform architecture and infrastructure.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
