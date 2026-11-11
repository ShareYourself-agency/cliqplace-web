import { gzipSync, gunzipSync } from 'node:zlib';
import { del, get, list, put } from '@vercel/blob';
import { db, insertLead } from './db';

/* Backups → Vercel Blob (private store). ENV: BLOB_READ_WRITE_TOKEN (set automatically when the store is connected).
   - automatic: Vercel Cron every 6 h (/api/cron/backup) + manual button in /admin/zalohy
   - kept: last 120 snapshots (≈ 30 days at 4/day)
   - form fallback: if the database is down, an inquiry is parked in Blob "inbox/" and imported later */

export const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const KEEP = 120;
const TABLES = ['leads', 'lead_events', 'tasks', 'admin_users'] as const;

export type BackupInfo = { pathname: string; size: number; uploadedAt: Date; name: string };

export async function makeBackup(reason: string) {
  const s = await db();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    try {
      data[t] = await s.unsafe(`select * from ${t} order by id`);
    } catch {
      data[t] = [];
    }
  }
  const payload = { app: 'cliqplace-crm', version: 1, created_at: new Date().toISOString(), reason, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])), data };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const body = gzipSync(Buffer.from(JSON.stringify(payload)));
  const res = await put(`backups/crm-${stamp}.json.gz`, body, { access: 'private', contentType: 'application/gzip', addRandomSuffix: false, allowOverwrite: true });
  await prune();
  return { pathname: res.pathname, size: body.length, counts: payload.counts };
}

export async function listBackups(): Promise<BackupInfo[]> {
  const out: BackupInfo[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'backups/', cursor, limit: 1000 });
    for (const b of r.blobs) out.push({ pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt), name: b.pathname.replace('backups/', '') });
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

async function prune() {
  const all = await listBackups();
  const old = all.slice(KEEP);
  if (old.length) await del(old.map((b) => b.pathname));
}

export async function lastBackupAge() {
  const r = await list({ prefix: 'backups/', limit: 1000 });
  const newest = r.blobs.reduce((m, b) => Math.max(m, new Date(b.uploadedAt).getTime()), 0);
  return newest ? Date.now() - newest : Infinity;
}

export async function readBackup(pathname: string) {
  if (!/^backups\/crm-[\w-]+\.json\.gz$/.test(pathname)) throw new Error('bad name');
  const r = await get(pathname, { access: 'private' });
  if (!r || !r.stream) throw new Error('not found');
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  return buf;
}

/** Safe restore: re-inserts rows that are MISSING (by id). Never deletes or overwrites anything. */
export async function restoreMissing(pathname: string) {
  const json = JSON.parse(gunzipSync(await readBackup(pathname)).toString('utf8'));
  const s = await db();
  const restored: Record<string, number> = {};
  for (const t of ['admin_users', 'leads', 'lead_events', 'tasks'] as const) {
    const rows = (json.data?.[t] || []) as Record<string, unknown>[];
    let n = 0;
    for (const row of rows) {
      const cols = await columnsOf(t);
      const clean = Object.fromEntries(Object.entries(row).filter(([k]) => cols.has(k)));
      const r = await s`insert into ${s(t)} ${s(clean)} on conflict do nothing returning id`;
      n += r.length;
    }
    if (n) await s.unsafe(`select setval(pg_get_serial_sequence('${t}', 'id'), (select coalesce(max(id), 1) from ${t}))`);
    restored[t] = n;
  }
  return restored;
}

const colCache = new Map<string, Set<string>>();
async function columnsOf(t: string) {
  if (colCache.has(t)) return colCache.get(t)!;
  const s = await db();
  const rows = await s<{ column_name: string }[]>`select column_name from information_schema.columns where table_name = ${t}`;
  const set = new Set(rows.map((r) => r.column_name));
  colCache.set(t, set);
  return set;
}

/* ---------- inquiry fallback when the DB is unavailable ---------- */
export async function parkInquiry(data: Record<string, unknown>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await put(`inbox/${id}.json`, JSON.stringify({ ...data, received_at: new Date().toISOString() }), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
}

let lastInboxCheck = 0;
export async function importParked() {
  if (!hasBlob() || Date.now() - lastInboxCheck < 60_000) return 0;
  lastInboxCheck = Date.now();
  const r = await list({ prefix: 'inbox/', limit: 100 });
  let n = 0;
  for (const b of r.blobs) {
    try {
      const g = await get(b.pathname, { access: 'private' });
      if (!g?.stream) continue;
      const d = JSON.parse(await new Response(g.stream).text());
      await insertLead(
        { company: d.company, name: d.name, email: d.email, phone: d.phone, message: d.message, source: d.source || 'Web – formulář', created_at: d.received_at },
        { consent: true, eventText: 'Poptávka z webu (doručena ze záložní schránky)' },
      );
      await del(b.pathname);
      n++;
    } catch (e) {
      console.error('[inbox] import failed', b.pathname, e);
    }
  }
  return n;
}
