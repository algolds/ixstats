/** "Good morning" (5 to 11), "Good afternoon" (12 to 16), "Good evening" (17 to 20), else "Good night". */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}
