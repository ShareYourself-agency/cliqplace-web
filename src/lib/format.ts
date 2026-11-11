const TZ = 'Europe/Prague';

export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(d));

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

export function ago(d: Date | string) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'teď';
  if (s < 3600) return `před ${Math.floor(s / 60)} min`;
  if (s < 86400) return `před ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  if (days === 1) return 'včera';
  if (days < 30) return `před ${days} dny`;
  return fmtDate(d);
}

export const czk = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n) + ' Kč';
