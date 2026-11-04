/**
 * UK formatting helpers. Dates are DD/MM/YYYY, times 24 hour, Europe/London.
 * Money is held in pence and rendered as £.
 */
export const TIMEZONE = "Europe/London";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const longDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
});

type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A date-only value (YYYY-MM-DD) rendered as DD/MM/YYYY without timezone shifts. */
export function formatDateOnly(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (d instanceof Date) return dateFmt.format(d);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return formatDate(d);
}

export function formatDate(d: DateInput): string {
  const date = toDate(d);
  return date ? dateFmt.format(date) : "";
}

export function formatTime(d: DateInput): string {
  const date = toDate(d);
  return date ? timeFmt.format(date) : "";
}

export function formatDateTime(d: DateInput): string {
  const date = toDate(d);
  return date ? `${dateFmt.format(date)} ${timeFmt.format(date)}` : "";
}

export function formatLongDate(d: DateInput): string {
  const date = toDate(d);
  return date ? longDateFmt.format(date) : "";
}

export function formatShortDate(d: DateInput): string {
  const date = toDate(d);
  return date ? shortDateFmt.format(date) : "";
}

/** "19:30:00" -> "19:30" */
export function formatClock(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function formatMoney(pence: number | null | undefined, opts: { compact?: boolean } = {}): string {
  const p = pence ?? 0;
  const pounds = p / 100;
  if (opts.compact && Math.abs(pounds) >= 1000) {
    return `£${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, notation: "compact" }).format(pounds)}`;
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pounds);
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB").format(n ?? 0);
}

export function formatPercent(fraction: number | null | undefined, digits = 0): string {
  return `${((fraction ?? 0) * 100).toFixed(digits)}%`;
}

/** Relative time such as "3 min ago" or "in 2 h". */
export function formatRelative(d: DateInput, now: Date = new Date()): string {
  const date = toDate(d);
  if (!date) return "";
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let text: string;
  if (abs < minute) text = "just now";
  else if (abs < hour) text = `${Math.round(abs / minute)} min`;
  else if (abs < day) text = `${Math.round(abs / hour)} h`;
  else if (abs < 30 * day) text = `${Math.round(abs / day)} d`;
  else text = formatDate(date);
  if (text === "just now" || abs >= 30 * day) return text;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

/** Normalise UK postcodes to "NG1 1AA" style. */
export function formatPostcode(pc: string | null | undefined): string {
  if (!pc) return "";
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 5) return clean;
  return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
}

/** Parse "£12.50", "12.5" or "1250p" into pence. Returns null when invalid. */
export function parseMoneyToPence(input: string): number | null {
  const s = input.trim().replace(/[£,\s]/g, "");
  if (!s) return null;
  if (/^\d+p$/i.test(s)) return parseInt(s, 10);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}
