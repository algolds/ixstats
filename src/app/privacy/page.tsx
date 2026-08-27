import React from "react";
import { type Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  Lock,
  EyeClosed as EyeOff,
  UserXmark as UserX,
  Cookie,
  Mail,
  InfoCircle as Info,
  Server,
} from "iconoir-react";
import { LegalDocumentLayout, type LegalSectionItem } from "~/components/ui/LegalDocumentLayout";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

export const metadata: Metadata = {
  title: "Privacy Policy — IxStates",
  description: "Privacy Policy and Data Protection practices for the IxStates platform.",
};

const SECTIONS: LegalSectionItem[] = [
  {
    id: "data-collected",
    title: "1. Information We Collect",
    summary: "Account credentials, linked platform IDs, in-game stats, and security logs",
  },
  {
    id: "how-we-use-data",
    title: "2. How We Use Data & Zero-Sale Policy",
    summary: "Authentication, simulation engine operation, and strict non-monetization",
  },
  {
    id: "subprocessors-storage",
    title: "3. Subprocessors & Data Infrastructure",
    summary: "Clerk authentication and secured self-hosted databases",
  },
  {
    id: "cookies-local-storage",
    title: "4. Cookies & Local Browser Storage",
    summary: "Functional session tokens and zero third-party advertising trackers",
  },
  {
    id: "user-rights-erasure",
    title: "5. User Rights & Simulation Continuity",
    summary: "GDPR/CCPA erasure, PII hard-purge, and anonymized world archiving",
  },
  {
    id: "security-contact",
    title: "6. Security Safeguards & Inquiries",
    summary: "Data encryption, age 16+ policy, and privacy contact",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      subtitle="Your privacy is paramount. This Privacy Policy details how IxStates collects, processes, stores, and protects your information, and how your rights are safeguarded under global privacy standards."
      badge="Privacy & Data Protection"
      lastUpdated="August 16, 2026"
      version='1.0 "Ogma"'
      sections={SECTIONS}
    >
      {/* Preamble / Introduction */}
      <CutoutCard
        texture="triangular"
        textureOpacity={0.02}
        className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
      >
        <CutoutCardContent className="text-muted-foreground space-y-3 p-6 text-sm leading-relaxed sm:p-8">
          <p>
            This Privacy Policy explains how the{" "}
            <strong>Ixnay Community and IxWiki Administration</strong> (&ldquo;
            <strong>IxStates</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;, &ldquo;
            <strong>us</strong>&rdquo;, or &ldquo;
            <strong>our</strong>&rdquo;) handles personal information when you access or use our web
            applications, simulation systems, and creative tools at <code>ixwiki.com</code>.
          </p>
          <p>
            We are committed to operating a transparent, hobbyist-centered conworlding platform that
            treats user data with respect. We collect only what is strictly necessary to run the
            simulation, protect system security, and render collaborative features. For terms
            governing game rules and licensing, please see our{" "}
            <Link
              href="/terms"
              className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
            >
              Terms of Service
            </Link>
            .
          </p>
        </CutoutCardContent>
      </CutoutCard>

      {/* Section 1 */}
      <div id="data-collected" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Database className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                1. Information We Collect
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong> We
                only collect what is needed to create your account (via Clerk), link optional
                services (Discord/Wiki), store your in-game nations/cards/posts, and defend the
                server against spam and DDoS attacks.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.1 Account &amp; Authentication Identifiers
                </h3>
                <p>
                  When you register an account, authentication is processed via Clerk. We receive
                  and store:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Your unique Clerk User ID (<code>clerkUserId</code>).
                  </li>
                  <li>Your verified email address and primary display username.</li>
                  <li>Account creation and last update timestamps.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.2 External Account Linking (IxnayID)
                </h3>
                <p>
                  If you voluntarily link external platforms to your IxStates identity, we store:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong>Discord:</strong> Your Discord User ID and username (for role
                    synchronization and bot notifications).
                  </li>
                  <li>
                    <strong>MediaWiki (IxWiki):</strong> Your wiki user ID and username (for article
                    editing attribution).
                  </li>
                  <li>
                    <strong>XenForo:</strong> Your forum member ID (for community forum
                    integration).
                  </li>
                  <li>
                    <strong>NationStates:</strong> Your verified nation name (for card deck imports
                    and ownership checks).
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.3 In-Game Simulation &amp; User-Generated Content
                </h3>
                <p>
                  We store the creative content and simulation state you produce, including national
                  economic statistics, tax policies, cabinet configurations, ThinkPages posts and
                  comments, persona profiles, direct messages (ThinkShare), card trade offers, and
                  Onoma conlang lexicons.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.4 Technical &amp; Security Logs
                </h3>
                <p>
                  When your browser makes requests to our servers, we temporarily record IP
                  addresses and user-agent strings in secure server access logs, Redis rate-limiting
                  caches, and PostgreSQL security audit tables. These logs are retained solely for
                  DDoS mitigation, brute-force defense, and rate-limit enforcement.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 2 */}
      <div id="how-we-use-data" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <EyeOff className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                2. How We Use Data &amp; Zero-Sale Commitment
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Our Guarantee:</strong> We{" "}
                <strong>never</strong> sell, rent, or trade your personal information. We do not run
                third-party advertising trackers. Your data is used solely to run the game and
                protect the community.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <p>We process your data strictly for the following operational purposes:</p>
              <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Service Delivery:</strong> Managing authentication sessions, calculating
                  economic simulation cycles, rendering maps, and processing trades.
                </li>
                <li>
                  <strong>Communication:</strong> Delivering transactional in-game alerts,
                  diplomatic notifications, and account security notices.
                </li>
                <li>
                  <strong>Security &amp; Abuse Prevention:</strong> Enforcing rate limits,
                  preventing denial-of-service attempts, preventing multi-accounting exploits, and
                  investigating violations of our Terms of Service.
                </li>
              </ul>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 3 */}
      <div id="subprocessors-storage" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Server className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                3. Subprocessors &amp; Data Infrastructure
              </h2>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <p>
                We work with trusted third-party infrastructure providers to host and secure the
                platform:
              </p>
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div className="border-border/70 bg-muted/20 rounded-xl border p-4">
                  <h4 className="text-foreground text-sm font-semibold">
                    Clerk Inc. (United States)
                  </h4>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Provides secure authentication, session management, multi-factor authentication,
                    and encrypted credential storage.
                  </p>
                </div>
                <div className="border-border/70 bg-muted/20 rounded-xl border p-4">
                  <h4 className="text-foreground text-sm font-semibold">
                    Self-Hosted Infrastructure
                  </h4>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Primary PostgreSQL/PostGIS and Redis database instances run within secured
                    Docker containers on private dedicated servers with strict firewall access.
                  </p>
                </div>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 4 */}
      <div id="cookies-local-storage" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Cookie className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                4. Cookies &amp; Local Browser Storage
              </h2>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <p>
                IxStates uses strictly functional and necessary cookies and local storage tokens. We
                do not use third-party cross-site tracking cookies, behavioral ad pixels, or
                analytics trackers.
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                <li>
                  <strong>Clerk Session Tokens:</strong> Secure JWT cookies required to authenticate
                  your session.
                </li>
                <li>
                  <strong>Active Session Preferences:</strong> Browser local storage keys saving
                  your active country selection, theme choice (dark/light mode), and navigation
                  drawer state.
                </li>
              </ul>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 5 */}
      <div id="user-rights-erasure" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UserX className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                5. User Rights, Erasure &amp; Simulation Continuity
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You can request full deletion of your personal data at any time. We will permanently
                delete your email, login, and linked accounts. To avoid breaking the persistent
                simulation for other players, public national records and conlang dictionaries are
                unlinked and archived as historical world artifacts.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.1 Data Rights (GDPR &amp; CCPA Compliance)
                </h3>
                <p>
                  Regardless of your geographic location, you have the following privacy rights:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong>Right of Access:</strong> You may request a copy of all personal data we
                    hold associated with your account.
                  </li>
                  <li>
                    <strong>Right to Rectification:</strong> You may correct inaccurate profile data
                    directly in account settings.
                  </li>
                  <li>
                    <strong>Right to Data Portability:</strong> You may export your custom Onoma
                    conlang lexicons and nation summaries.
                  </li>
                  <li>
                    <strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You may
                    request permanent deletion of your account and personal data.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.2 Account Deletion &amp; Simulation Continuity Architecture
                </h3>
                <p>When an account erasure request is processed:</p>
                <ol className="text-muted-foreground mt-2 list-decimal space-y-1.5 pl-5">
                  <li>
                    <strong>Permanent PII Purge:</strong> Your Clerk User ID, email address,
                    password records, linked Discord/Wiki/Forum associations, and IP access logs are
                    permanently expunged.
                  </li>
                  <li>
                    <strong>Simulation Anonymization &amp; Archiving:</strong> In-game entities
                    (including public nation profiles, historical trade records, map polygon
                    placements, and public wiki contributions) are severed from your identity and
                    converted into an archived, non-player historic state. This ensures that shared
                    historical timelines and regional economic networks do not experience
                    catastrophic corruption.
                  </li>
                </ol>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 6 */}
      <div id="security-contact" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                6. Security Safeguards &amp; Privacy Contact
              </h2>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.1 Security Standards
                </h3>
                <p>
                  All network communication is strictly encrypted in transit using Transport Layer
                  Security (TLS 1.3). Database backups are encrypted at rest, and access to
                  production servers is restricted to authorized system administrators via SSH key
                  authentication.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.2 Children&rsquo;s Privacy (Age 16+ Requirement)
                </h3>
                <p>
                  IxStates is strictly intended for individuals aged <strong>16 and older</strong>.
                  We do not knowingly solicit or collect personal information from individuals under
                  16. If you believe a minor under 16 has provided us with personal data, please
                  contact us immediately for prompt deletion.
                </p>
              </div>

              <div className="border-border/80 bg-muted/30 mt-4 flex items-center gap-3 rounded-xl border p-4">
                <Mail className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-muted-foreground text-xs">
                  To request data export, submit an erasure request, or ask privacy questions,
                  please email our data protection team at{" "}
                  <a
                    href="mailto:privacy@ixwiki.com"
                    className="font-semibold text-amber-600 underline dark:text-amber-400"
                  >
                    privacy@ixwiki.com
                  </a>
                  .
                </div>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    </LegalDocumentLayout>
  );
}
