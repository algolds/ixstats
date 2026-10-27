export const getPlayerOverall = (ratings: any): number => {
  if (!ratings || typeof ratings !== "object") return 50;
  const vals = Object.values(ratings).filter((v) => typeof v === "number") as number[];
  if (vals.length === 0) return 50;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};
