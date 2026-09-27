const MINUTE = 60_000;

/** "just now", "12 min ago", "3 h ago", or a date for anything older than a day. */
export function timeAgo(iso: string, now: string | Date = new Date()): string {
  const elapsed = new Date(now).getTime() - new Date(iso).getTime();
  const minutes = Math.floor(elapsed / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/** "2:14 p.m." in the event's time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

/** "1st", "2nd", "3rd", "4th", … */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}
