"use client";

import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { timeAgo } from "~/lib/format/compact";
import { JobActions } from "./JobActions";
import { jobLabel, STATUS_LABELS, statusTone, type JobRow } from "./job-labels";

interface JobsTableProps {
  jobs: readonly JobRow[];
  onOpen: (jobId: string) => void;
  /** Left out on a realm's own page, where every job is its */
  showRealm?: boolean;
}

function progressText(job: JobRow): string {
  if (job.status !== "running") return job.stage ?? "";
  return `${job.stage ?? "Working"}, ${Math.round(job.progress)}%`;
}

/** Jobs newest first; a job's name opens its detail, and its actions sit at the end of the row. */
export function JobsTable({ jobs, onOpen, showRealm = true }: JobsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job</TableHead>
          {showRealm && <TableHead>Realm</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell>
              <button
                type="button"
                onClick={() => onOpen(job.id)}
                aria-label={`Open ${jobLabel(job)} ${job.id}`}
                className="text-label focus-visible:outline-tint rounded-control text-left font-medium focus-visible:outline-2"
              >
                {jobLabel(job)}
              </button>
              {job.filename && (
                <p className="text-label-secondary text-footnote truncate">{job.filename}</p>
              )}
            </TableCell>
            {showRealm && <TableCell>{job.realm?.name ?? "No realm"}</TableCell>}
            <TableCell>
              <Badge variant={statusTone(job.status)}>
                {STATUS_LABELS[job.status] ?? job.status}
              </Badge>
              <p className="text-label-secondary text-footnote">{progressText(job)}</p>
            </TableCell>
            <TableCell>{timeAgo(job.createdAt)}</TableCell>
            <TableCell>
              <JobActions job={job} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
