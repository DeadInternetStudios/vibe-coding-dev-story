import { DAYS_PER_MONTH, DAYS_PER_YEAR } from './config';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const yearOf = (day: number) => 1 + Math.floor(day / DAYS_PER_YEAR);
/** 1 to 12 */
export const monthOf = (day: number) => 1 + Math.floor((day % DAYS_PER_YEAR) / DAYS_PER_MONTH);
/** 1 to 4 */
export const weekOf = (day: number) => 1 + Math.floor((day % DAYS_PER_MONTH) / 7);
/** 0 is Monday, 4 is Friday */
export const dowOf = (day: number) => day % 7;
export const isWorkday = (day: number) => dowOf(day) < 5;
export const isFriday = (day: number) => dowOf(day) === 4;
export const isPayday = (day: number) => day % DAYS_PER_MONTH === DAYS_PER_MONTH - 1;
export const isMonthStart = (day: number) => day % DAYS_PER_MONTH === 0;
export const isYearEnd = (day: number) => day % DAYS_PER_YEAR === DAYS_PER_YEAR - 1;

export function dateLabel(day: number): string {
  return `Y${yearOf(day)} ${MONTH_NAMES[monthOf(day) - 1]} W${weekOf(day)} ${DOW[dowOf(day)]}`;
}

export function dowName(day: number): string {
  return DOW[dowOf(day)]!;
}

export function monthName(month: number): string {
  return MONTH_NAMES[(month - 1 + 12) % 12]!;
}

/** $1,234 or -$1,234 */
export function money(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${r < 0 ? '-' : ''}$${s}`;
}

/** +$1,234 or -$1,234 */
export function signedMoney(n: number): string {
  return `${n >= 0 ? '+' : ''}${money(n)}`;
}

/** $1.2k, $34k, $1.2M, for tight spaces. */
export function shortMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}k`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

export function shortNumber(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${sign}${Math.round(a / 1e3)}k`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}k`;
  return `${sign}${Math.round(a)}`;
}

export function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
