/**
 * LEVEL 5: Functions, Promises & Async/Await
 *
 * Objective: Export an async function named 'fetchNationIntelReport' taking a nationSlug (string)
 * and returning a Promise resolving to { nation: string, intelScore: number, status: string }.
 */

export interface IntelReport {
  nation: string;
  intelScore: number;
  status: string;
}

export async function fetchNationIntelReport(nationSlug: string): Promise<IntelReport> {
  // TODO: Return a Promise that resolves after a 300ms delay using setTimeout
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nation: nationSlug,
        intelScore: 92,
        status: "Active",
      });
    }, 300);
  });
}
