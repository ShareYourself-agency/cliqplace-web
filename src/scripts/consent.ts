/* Cookie souhlas + Google Consent Mode v2 + Meta Pixel. Uloženo v localStorage „cq_consent“ na 12 měsíců. */
type Consent = { v: 1; t: number; a: boolean; m: boolean };
type W = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  fbq?: (...args: unknown[]) => void;
  cqLoadPixel?: () => void;
};
const w = window as W;
const KEY = 'cq_consent';

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as Consent | null;
    if (!c || c.v !== 1 || Date.now() - c.t > 365 * 864e5) return null;
    return c;
  } catch {
    return null;
  }
}

function apply(c: Consent) {
  w.gtag?.('consent', 'update', {
    ad_storage: c.m ? 'granted' : 'denied',
    ad_user_data: c.m ? 'granted' : 'denied',
    ad_personalization: c.m ? 'granted' : 'denied',
    analytics_storage: c.a ? 'granted' : 'denied',
  });
  w.dataLayer?.push({ event: 'cq_consent_update', consent_analytics: c.a, consent_marketing: c.m });
  if (c.m) w.cqLoadPixel?.();
  else if (w.fbq) w.fbq('consent', 'revoke');
}

function save(a: boolean, m: boolean) {
  const c: Consent = { v: 1, t: Date.now(), a, m };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
  apply(c);
  close();
}

const bar = () => document.querySelector<HTMLElement>('[data-cookiebar]');
function close() { const b = bar(); if (b) b.hidden = true; }
function open(prefs = false) {
  const b = bar();
  if (!b) return;
  const c = getConsent();
  b.querySelectorAll<HTMLInputElement>('[data-consent]').forEach((i) => (i.checked = !!c?.[i.dataset.consent as 'a' | 'm']));
  showPrefs(prefs);
  b.hidden = false;
}
function showPrefs(on: boolean) {
  const b = bar();
  if (!b) return;
  b.querySelector<HTMLElement>('[data-cookiebar-prefs]')!.hidden = !on;
  b.querySelector<HTMLElement>('[data-cookiebar-main]')!.hidden = on;
  b.querySelector<HTMLElement>('[data-cookie-action="settings"]')!.hidden = on;
  b.querySelector<HTMLElement>('[data-cookie-action="save"]')!.hidden = !on;
}

export function initConsent() {
  if (!getConsent()) open(false);
  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-cookie-action], [data-cookie-settings]');
    if (!t) return;
    if (t.hasAttribute('data-cookie-settings')) { e.preventDefault(); open(true); return; }
    const act = t.dataset.cookieAction;
    if (act === 'accept') save(true, true);
    else if (act === 'reject') save(false, false);
    else if (act === 'settings') showPrefs(true);
    else if (act === 'save') {
      const b = bar()!;
      const val = (k: string) => !!b.querySelector<HTMLInputElement>(`[data-consent="${k}"]`)?.checked;
      save(val('a'), val('m'));
    }
  });
}

/* ---- konverze po odeslání poptávky ---- */
export function trackLead(eventId: string) {
  w.dataLayer?.push({ event: 'generate_lead', form_name: 'kontakt', lead_event_id: eventId });
  w.gtag?.('event', 'conversion', {
    send_to: 'AW-18469650100/HFXTCOep3YQdELT9gedE',
    value: 1.0,
    currency: 'CZK',
    transaction_id: eventId,
  });
  if (getConsent()?.m) w.fbq?.('track', 'Lead', {}, { eventID: eventId });
}

export function metaCookies() {
  const get = (n: string) => document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1] || '';
  return { fbp: get('_fbp'), fbc: get('_fbc') };
}
