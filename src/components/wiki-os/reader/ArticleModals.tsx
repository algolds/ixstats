"use client";

import React from "react";
import Link from "next/link";
import {
  ClockRotateRight as History,
  Link as Link2,
  Xmark as X,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

export function QuickHistoryModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 10 },
    { staleTime: 30_000 }
  );

  const revisions = data?.revisions ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <History className="h-4 w-4" />
            <span>Recent History</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading history...</div>}
          {revisions.map((rev, idx) => {
            const prevRev = revisions[idx + 1];
            const sizeChange = prevRev ? rev.size - prevRev.size : rev.size;
            return (
              <div key={rev.revid} className="wikios-quick-modal-row">
                <div className="wikios-quick-modal-row-main">
                  <span className="wikios-quick-modal-date">
                    {new Date(rev.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="wikios-quick-modal-user">{rev.user}</span>
                  <span
                    className={`wikios-quick-modal-diff ${sizeChange > 0 ? "wikios-diff-positive" : sizeChange < 0 ? "wikios-diff-negative" : ""}`}
                  >
                    {sizeChange > 0 ? "+" : ""}
                    {sizeChange.toLocaleString()}
                  </span>
                  {rev.minor && <span className="wikios-quick-modal-minor">m</span>}
                </div>
                {rev.comment && <div className="wikios-quick-modal-comment">{rev.comment}</div>}
              </div>
            );
          })}
        </div>

        <Link
          href={withBasePath(`/wiki/history/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink className="h-3 w-3" />
          View full history
        </Link>
      </div>
    </div>
  );
}

export function QuickBacklinksModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getBacklinks.useQuery(
    { title, limit: 20 },
    { staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Link2 className="h-4 w-4" />
            <span>What Links Here</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading backlinks...</div>}
          {links.length === 0 && !isLoading && (
            <div className="wikios-quick-modal-empty">No pages link to this article.</div>
          )}
          {links.map((link, i) => (
            <Link
              key={`${link.title}-${i}`}
              href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="wikios-quick-modal-link"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <Link
          href={withBasePath(`/wiki/whatlinkshere/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink className="h-3 w-3" />
          View all backlinks
        </Link>
      </div>
    </div>
  );
}
