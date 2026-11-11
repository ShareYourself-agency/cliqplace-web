import type { APIRoute } from 'astro';
import { db, hasDb, statusLabel, type Lead } from '../../lib/db';
import { fmtDateTime } from '../../lib/format';
export const prerender = false;

const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection in Excel
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async () => {
  if (!hasDb()) return new Response('Databáze není připojená.', { status: 503 });
  const s = await db();
  const rows = await s<Lead[]>`select * from leads order by created_at desc`;
  const head = ['ID', 'Přišlo', 'Firma', 'Jméno', 'E-mail', 'Telefon', 'Zpráva', 'Stav', 'Řeší', 'Hodnota (Kč)', 'Souhlas'];
  const lines = rows.map((l) =>
    [l.id, fmtDateTime(l.created_at), l.company, l.name, l.email, l.phone, l.message, statusLabel(l.status), l.owner, l.value ?? '', l.consent_at ? fmtDateTime(l.consent_at) : '']
      .map(cell)
      .join(';'),
  );
  const csv = '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cliqplace-leady-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
