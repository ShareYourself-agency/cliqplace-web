const TZ = 'Europe/Prague';

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(d)) : '—';

export const fmtShort = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric' }).format(new Date(d)) : '—';

export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

export function ago(d: Date | string | null | undefined) {
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'teď';
  if (s < 3600) return `před ${Math.floor(s / 60)} min`;
  if (s < 86400) return `před ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  if (days === 1) return 'včera';
  if (days < 30) return `před ${days} dny`;
  return fmtDate(d);
}

/** Prague calendar day number for comparisons */
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

export function due(d: Date | string | null | undefined): { label: string; tone: '' | 'red' | 'amber' | 'green' } {
  if (!d) return { label: 'bez termínu', tone: '' };
  const date = new Date(d);
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const k = dayKey(date);
  const time = new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(date);
  const t = time === '00:00' ? '' : ` ${time}`;
  if (k < today) return { label: `po termínu · ${fmtShort(date)}`, tone: 'red' };
  if (k === today) return { label: `dnes${t}`, tone: 'amber' };
  if (k === tomorrow) return { label: `zítra${t}`, tone: 'green' };
  return { label: `${fmtShort(date)}${t}`, tone: '' };
}

/** value for <input type="datetime-local"> in Prague time */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return '';
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  return p.replace(' ', 'T');
}
export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
}
/** parse "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD" entered in Prague time → Date */
export function fromLocalInput(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, da, h = '09', mi = '00'] = m;
  // find the Prague offset for that moment
  const guess = new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi));
  const pragueStr = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(guess);
  const asUtc = new Date(pragueStr.replace(' ', 'T') + ':00Z');
  return new Date(guess.getTime() - (asUtc.getTime() - guess.getTime()));
}

export const czk = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n) + ' Kč';

export const initials = (s: string | null | undefined) =>
  (s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
