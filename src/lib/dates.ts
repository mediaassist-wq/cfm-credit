/** Date helpers — months are stored as first-of-month (YYYY-MM-01). */

export function firstOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Returns the first-of-month strings for the last `n` months, oldest first. */
export function lastNMonths(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push(firstOfMonth(d));
  }
  return out;
}

/** "2026-09-01" -> "Sep 2026" */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}
