/**
 * Issue deadlines are only real when `ISSUES_ENFORCE_DEADLINES` is on: nothing expires an issue
 * otherwise, and Delegate is allowed. The owner's reads drop the deadline while enforcement is
 * off, so no screen shows "Overdue" for a deadline that never bites.
 */
export function withEnforcedDeadline<T extends { deadlineIxTime: number | null }>(
  issue: T,
  enforceDeadlines: boolean
): T {
  return enforceDeadlines ? issue : { ...issue, deadlineIxTime: null };
}
