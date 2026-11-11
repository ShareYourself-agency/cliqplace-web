import type { APIRoute } from 'astro';
import { hasBlob, importParked, lastBackupAge, makeBackup } from '../../../lib/backup';
import { hasDb } from '../../../lib/db';
export const prerender = false;

/* Called by Vercel Cron (vercel.json). If CRON_SECRET is set, Vercel sends it as a Bearer token.
   Without a secret only Vercel's cron user-agent is accepted and runs are throttled, so abuse is harmless. */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const ua = request.headers.get('user-agent') || '';
  const ok = secret ? auth === `Bearer ${secret}` : ua.includes('vercel-cron');
  if (!ok) return new Response('Unauthorized', { status: 401 });
  if (!hasDb() || !hasBlob()) return Response.json({ ok: false, reason: 'not configured' }, { status: 503 });

  try {
    const imported = await importParked();
    if ((await lastBackupAge()) < 60 * 60 * 1000) return Response.json({ ok: true, skipped: 'recent backup exists', imported });
    const r = await makeBackup('automaticky');
    return Response.json({ ok: true, ...r, imported });
  } catch (e) {
    console.error('[cron/backup]', e);
    return Response.json({ ok: false }, { status: 500 });
  }
};
