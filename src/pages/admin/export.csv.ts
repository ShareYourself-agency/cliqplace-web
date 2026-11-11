import type { APIRoute } from 'astro';
import { db, hasDb, stageLabel } from '../../lib/db';
import { fmtDate, fmtDateTime } from '../../lib/format';
export const prerender = false;

const cell = (v: unknown) => {
  let s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection in Excel
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async () => {
  if (!hasDb()) return new Response('Databáze není připojená.', { status: 503 });
  const s = await db();
  const rows = await s<any[]>`
    select l.*, u.name as owner_name, u.email as owner_email from leads l left join admin_users u on u.id = l.owner_id
    where l.deleted_at is null order by l.created_at desc`;
  const head = ['ID', 'Přišlo', 'Firma', 'Kontaktní osoba', 'Pozice', 'E-mail', 'Telefon', 'Typ provozu', 'Město', 'IČO', 'Web', 'Zdroj', 'Fáze', 'Řeší', 'Hodnota (Kč)', 'Pravděpodobnost %', 'Očekávané uzavření', 'Zájem o', 'Co klient chce', 'Stávající řešení', 'Kapacita', 'Osloven', 'Poslední krok', 'Poslední aktivita', 'Další krok', 'Termín dalšího kroku', 'Důvod prohry', 'Štítky', 'Původní poptávka', 'Souhlas GDPR'];
  const lines = rows.map((l) =>
    [l.id, fmtDateTime(l.created_at), l.company, l.name, l.position, l.email, l.phone, l.segment, l.city, l.ico, l.website, l.source, stageLabel(l.status), l.owner_name || l.owner_email || '', l.value ?? '', l.probability ?? '', l.expected_close ? fmtDate(l.expected_close) : '', l.products, l.needs, l.current_solution, l.capacity, l.first_contact_at ? fmtDate(l.first_contact_at) : '', l.last_step, l.last_activity_at ? fmtDateTime(l.last_activity_at) : '', l.next_step, l.next_step_at ? fmtDateTime(l.next_step_at) : '', l.lost_reason, l.tags, l.message, l.consent_at ? fmtDateTime(l.consent_at) : '']
      .map(cell)
      .join(';'),
  );
  const csv = '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cliqplace-leady-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
