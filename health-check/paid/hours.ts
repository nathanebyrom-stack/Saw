// Working hours for the full report promise: Monday to Friday, 9:00 to 17:00, UK time.
// Bank holidays are not counted as closed (yet).
const OPEN = 9 * 60, CLOSE = 17 * 60;

function london(d: Date): { y: number; mo: number; day: number; wd: number; min: number } {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, mo: +p.month, day: +p.day, wd, min: +p.hour * 60 + +p.minute };
}
// The UTC instant for a London wall-clock time (handles GMT and BST).
function fromLondon(y: number, mo: number, day: number, min: number): Date {
  const guess = new Date(Date.UTC(y, mo - 1, day, Math.floor(min / 60), min % 60));
  const l = london(guess);
  const diff = (Date.UTC(l.y, l.mo - 1, l.day) - Date.UTC(y, mo - 1, day)) / 60000 + (l.min - min);
  return new Date(guess.getTime() - diff * 60000);
}
export function dueAfterWorkingMinutes(start: Date, minutes: number): Date {
  let t = new Date(start.getTime()), left = minutes;
  for (let guard = 0; guard < 30; guard++) {
    const l = london(t);
    const weekend = l.wd === 0 || l.wd === 6;
    if (weekend || l.min >= CLOSE) {   // jump to 9:00 on the next day, then re-check
      const next = new Date(Date.UTC(l.y, l.mo - 1, l.day) + 86400000);
      t = fromLondon(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), OPEN); continue;
    }
    if (l.min < OPEN) { t = fromLondon(l.y, l.mo, l.day, OPEN); continue; }
    const today = CLOSE - l.min;
    if (left <= today) return new Date(t.getTime() + left * 60000);
    left -= today;
    t = fromLondon(l.y, l.mo, l.day, CLOSE);
  }
  return t;
}
export function londonText(d: Date): string {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  // "Tuesday 24 November at 10:30 am" -> "Tuesday 24 November, 10.30am"
  return s.replace(" at ", ", ").replace(/ (am|pm)$/i, (m) => m.trim().toLowerCase()).replace(/:00(?=[ap]m)/, "").replace(/(\d):(\d\d)/, "$1.$2");
}
