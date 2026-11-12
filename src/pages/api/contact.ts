import type { APIRoute } from 'astro';
import { hasDb, insertLead } from '../../lib/db';
import { hasBlob, parkInquiry } from '../../lib/backup';

export const prerender = false;

/* ---- configuration (Vercel → Project → Settings → Environment Variables) ----
   RESEND_API_KEY  – API klíč z resend.com
   CONTACT_TO      – kam chodí poptávky (výchozí milan@cliqplace.cz, víc adres oddělit čárkou)
   CONTACT_FROM    – odesílatel z ověřené domény (výchozí "Web Cliqplace <web@cliqplace.cz>")
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

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Clean notification e-mail (inline styles only – e-mail clients ignore <style>) */
function leadHtml(f: { company: string; name: string; email: string; phone: string; message: string }, page: string) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #e3e7e2;color:#6b766f;font:12px/1.4 ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;width:120px;vertical-align:top">${k}</td><td style="padding:10px 0;border-top:1px solid #e3e7e2;font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0d1513">${v}</td></tr>`;
  const tel = f.phone ? `<a href="tel:${esc(f.phone.replace(/[^\d+]/g, ''))}" style="color:#2a4633">${esc(f.phone)}</a>` : '—';
  const when = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  return `<!doctype html><html lang="cs"><body style="margin:0;background:#f4f6f3;padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e3e7e2;border-radius:12px;overflow:hidden">
<tr><td style="background:#0d1513;padding:18px 24px;font:600 16px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff">cliqplace<span style="color:#c7ff9c;font-weight:400"> · nová poptávka</span></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font:12px/1.4 ui-monospace,Menlo,monospace;color:#6b766f;text-transform:uppercase;letter-spacing:.08em">${esc(when)}${page ? ` · ${esc(page)}` : ''}</p>
<h1 style="margin:0 0 18px;font:650 24px/1.2 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0d1513;letter-spacing:-.02em">${esc(f.company || f.name)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('Firma', esc(f.company || '—'))}
${row('Jméno', esc(f.name))}
${row('E-mail', `<a href="mailto:${esc(f.email)}" style="color:#2a4633">${esc(f.email)}</a>`)}
${row('Telefon', tel)}
${row('Zpráva', esc(f.message).replace(/\n/g, '<br>'))}
</table>
<p style="margin:22px 0 0"><a href="mailto:${esc(f.email)}?subject=${encodeURIComponent('Re: Vaše poptávka – Cliqplace')}" style="display:inline-block;background:#c7ff9c;color:#0d1513;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:12px 18px;border-radius:8px;text-decoration:none">Odpovědět zákazníkovi</a></p>
<p style="margin:18px 0 0;font:12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#85918a">Odesláno z formuláře na cliqplace.cz. Odesílatel souhlasil se zpracováním osobních údajů. Na tento e-mail můžete rovnou odpovědět.</p>
</td></tr></table></body></html>`;
}

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
  const to = process.env.CONTACT_TO || 'milan@cliqplace.cz';
  const from = process.env.CONTACT_FROM || 'Web Cliqplace <web@cliqplace.cz>';
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
          html: leadHtml(f, page),
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
