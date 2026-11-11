import type { APIRoute } from 'astro';
import { hasDb, insertLead } from '../../lib/db';
import { hasBlob, parkInquiry } from '../../lib/backup';

export const prerender = false;

/* ---- configuration (Vercel → Project → Settings → Environment Variables) ----
   RESEND_API_KEY  – API klíč z resend.com
   CONTACT_TO      – kam chodí poptávky (výchozí info@cliqplace.cz)
   CONTACT_FROM    – odesílatel z ověřené domény, např. "Web Cliqplace <web@cliqplace.cz>"
   DATABASE_URL    – Postgres pro admin /admin (leady se ukládají i bez e-mailu)
------------------------------------------------------------------------------- */

const MAX_BODY = 20_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>(); // best-effort, per serverless instance

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[a-z]{2,24}$/i;
const PHONE_RE = /^[0-9+()\s-]{6,40}$/;

type Fields = { company: string; name: string; phone: string; email: string; message: string; consent: string; website: string; ts: string };

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ');

function rateLimited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_MAX;
}

export const POST: APIRoute = async ({ request, clientAddress, url }) => {
  const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  const respond = (status: number, body: Record<string, unknown>) => {
    if (isForm && !wantsJson) {
      // no-JS fallback → back to the contact page
      const target = new URL('/kontakt', url);
      if (status < 300) target.searchParams.set('odeslano', '1');
      else target.searchParams.set('chyba', '1');
      return Response.redirect(target.toString(), 303);
    }
    return json(status, body);
  };

  // same-origin only
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return json(403, { error: 'Nepovolený původ požadavku.' });

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json(413, { error: 'Zpráva je příliš dlouhá.' });

  let raw: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { error: 'Zpráva je příliš dlouhá.' });
    raw = isForm ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text || '{}');
  } catch {
    return respond(400, { error: 'Neplatný požadavek.' });
  }

  const f: Fields = {
    company: oneLine(clean(raw.company, 160)),
    name: oneLine(clean(raw.name, 120)),
    phone: oneLine(clean(raw.phone, 40)),
    email: oneLine(clean(raw.email, 200)),
    message: clean(raw.message, 4000),
    consent: clean(raw.consent, 5),
    website: clean(raw.website, 200),
    ts: clean(raw.ts, 20),
  };

  // bots: honeypot filled or submitted faster than a human could → pretend success
  const elapsed = Date.now() - Number(f.ts || 0);
  if (f.website || (f.ts && elapsed < 2500)) return respond(200, { ok: true });

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || clientAddress || 'unknown';
  if (rateLimited(ip)) return respond(429, { error: 'Příliš mnoho pokusů. Zkuste to prosím za pár minut.' });

  const errors: string[] = [];
  if (f.name.length < 2) errors.push('jméno');
  if (!EMAIL_RE.test(f.email)) errors.push('e-mail');
  if (f.phone && !PHONE_RE.test(f.phone)) errors.push('telefon');
  if (f.message.length < 10) errors.push('popis');
  if (f.consent !== '1' && f.consent !== 'on' && f.consent !== 'true') errors.push('souhlas se zpracováním údajů');
  if (errors.length) return respond(422, { error: `Zkontrolujte prosím: ${errors.join(', ')}.` });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO || 'info@cliqplace.cz';
  const from = process.env.CONTACT_FROM || 'Web Cliqplace <onboarding@resend.dev>';
  if (!apiKey && !hasDb() && !hasBlob()) {
    console.error('[contact] neither DATABASE_URL nor RESEND_API_KEY is configured');
    return respond(503, { error: 'Formulář je dočasně nedostupný. Napište nám prosím na info@cliqplace.cz.' });
  }

  // 1) store the lead in the CRM (/admin); if the DB is down, park it in Blob so it is imported later
  let leadId: number | null = null;
  let parked = false;
  const ref = request.headers.get('referer');
  let page = '';
  try { page = ref ? new URL(ref).pathname : ''; } catch {}
  if (hasDb()) {
    try {
      leadId = await insertLead(
        { company: f.company, name: f.name, email: f.email, phone: f.phone, message: f.message, source: 'Web – formulář' },
        { consent: true, eventText: `Poptávka z webu${page ? ` (${page})` : ''}` },
      );
    } catch (e) {
      console.error('[contact] db insert failed', e);
    }
  }
  if (!leadId && hasBlob()) {
    try {
      await parkInquiry({ company: f.company, name: f.name, email: f.email, phone: f.phone, message: f.message, source: 'Web – formulář' });
      parked = true;
    } catch (e) {
      console.error('[contact] park failed', e);
    }
  }

  // 2) e-mail notification
  let mailed = false;
  if (apiKey) {
    const text = [
      'Nová poptávka z webu cliqplace.cz',
      '',
      `Firma: ${f.company || '—'}`,
      `Jméno: ${f.name}`,
      `E-mail: ${f.email}`,
      `Telefon: ${f.phone || '—'}`,
      '',
      'Zpráva:',
      f.message,
      '',
      '—',
      leadId ? `V administraci: ${new URL(`/admin/lead/${leadId}`, url).toString()}` : '',
      `Souhlas se zpracováním osobních údajů: ano (${new Date().toISOString()})`,
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: to.split(',').map((x) => x.trim()).filter(Boolean),
          reply_to: f.email,
          subject: `Poptávka z webu: ${f.company || f.name}`.slice(0, 150),
          text,
        }),
      });
      mailed = res.ok;
      if (!res.ok) console.error('[contact] Resend error', res.status, await res.text().catch(() => ''));
    } catch (e) {
      console.error('[contact] send failed', e);
    }
  }

  if (!leadId && !parked && !mailed) {
    return respond(502, { error: 'Zprávu se nepodařilo odeslat. Napište nám prosím na info@cliqplace.cz.' });
  }

  return respond(200, { ok: true });
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
