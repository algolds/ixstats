/**
 * CHALLENGE 4: Async Pipelines & Promises
 * 
 * Objective: Export an async function named 'fetchNationIntelligence' that simulates a network request
 * returning a Promise resolving to an intelligence score object.
 */

export async function fetchNationIntelligence(nationName: string): Promise<{ nation: string; intelScore: number }> {
  // TODO: Simulate an async network delay using setTimeout inside a Promise
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ nation: nationName, intelScore: 95 });
    }, 300);
  });
}
