import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { AstroCookies } from 'astro';
import { db, hasDb } from './db';

/* Admin accounts – e-mail + password, stored in Postgres (admin_users).
   First account: set ADMIN_EMAIL + ADMIN_PASSWORD in Vercel. On the first login with
   those credentials the account is created; more people are added in /admin/tym. */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const COOKIE = 'cq_admin';
const MAX_AGE = 60 * 60 * 12; // 12 h

export type AdminUser = { id: number; email: string; name: string; created_at: Date; last_login: Date | null };

let cachedSecret = '';
async function secret() {
  if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 24) return process.env.ADMIN_SECRET;
  if (cachedSecret) return cachedSecret;
  const s = await db();
  await s`create table if not exists admin_settings (key text primary key, value text not null)`;
  await s`insert into admin_settings (key, value) values ('session_secret', ${randomBytes(48).toString('base64url')}) on conflict (key) do nothing`;
  const [row] = await s<{ value: string }[]>`select value from admin_settings where key = 'session_secret'`;
  cachedSecret = row.value;
  return cachedSecret;
}

let usersReady: Promise<void> | null = null;
async function users() {
  const s = await db();
  if (!usersReady) {
    usersReady = (async () => {
      await s`
        create table if not exists admin_users (
          id serial primary key,
          email text not null unique,
          name text not null default '',
          pass_hash text not null,
          created_at timestamptz not null default now(),
          last_login timestamptz
        )`;
    })().catch((e) => { usersReady = null; throw e; });
  }
  await usersReady;
  return s;
}

const safeEq = (a: string | Buffer, b: string | Buffer) => {
  const x = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const y = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
async function verifyPassword(pw: string, stored: string) {
  const [alg, salt, key] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !key) return false;
  const test = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64url'), 64);
  return safeEq(test, Buffer.from(key, 'base64url'));
}

export const normEmail = (e: string) => e.trim().toLowerCase().slice(0, 200);
export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[a-z]{2,24}$/i;
export const passwordProblem = (pw: string) => (pw.length < 10 ? 'Heslo musí mít aspoň 10 znaků.' : '');

export const adminReady = () => hasDb();

/** returns the user on success, null on wrong credentials */
export async function login(emailRaw: string, pw: string): Promise<AdminUser | null> {
  const s = await users();
  const email = normEmail(emailRaw);
  let [u] = await s<(AdminUser & { pass_hash: string })[]>`select * from admin_users where email = ${email}`;

  if (!u) {
    // bootstrap the very first account from ENV
    const [{ n }] = await s<{ n: number }[]>`select count(*)::int as n from admin_users`;
    const envEmail = normEmail(process.env.ADMIN_EMAIL || '');
    const envPw = process.env.ADMIN_PASSWORD || '';
    if (n === 0 && envEmail && envPw && email === envEmail && safeEq(createHmac('sha256', 'x').update(pw).digest(), createHmac('sha256', 'x').update(envPw).digest())) {
      [u] = await s<(AdminUser & { pass_hash: string })[]>`
        insert into admin_users (email, name, pass_hash) values (${email}, '', ${await hashPassword(pw)})
        on conflict (email) do nothing returning *`;
      if (!u) return null;
    } else {
      await hashPassword(pw); // equalise timing
      return null;
    }
  } else if (!(await verifyPassword(pw, u.pass_hash))) {
    return null;
  }
  await s`update admin_users set last_login = now() where id = ${u.id}`;
  const { pass_hash: _p, ...user } = u;
  return user;
}

const sign = async (payload: string) => createHmac('sha256', await secret()).update(payload).digest('base64url');

export async function startSession(cookies: AstroCookies, userId: number, secure: boolean) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `v2.${userId}.${exp}`;
  cookies.set(COOKIE, `${payload}.${await sign(payload)}`, { path: '/', httpOnly: true, secure, sameSite: 'strict', maxAge: MAX_AGE });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export async function currentUser(cookies: AstroCookies): Promise<AdminUser | null> {
  if (!hasDb()) return null;
  const raw = cookies.get(COOKIE)?.value || '';
  const i = raw.lastIndexOf('.');
  if (i < 0) return null;
  const payload = raw.slice(0, i);
  const [v, uid, exp] = payload.split('.');
  if (v !== 'v2' || !(Number(exp) * 1000 > Date.now())) return null;
  if (!safeEq(raw.slice(i + 1), await sign(payload))) return null;
  const s = await users();
  const [u] = await s<AdminUser[]>`select id, email, name, created_at, last_login from admin_users where id = ${Number(uid)}`;
  return u || null;
}

export async function listUsers() {
  const s = await users();
  return s<AdminUser[]>`select id, email, name, created_at, last_login from admin_users order by created_at`;
}
export async function addUser(email: string, name: string, pw: string) {
  const s = await users();
  const rows = await s`insert into admin_users (email, name, pass_hash) values (${normEmail(email)}, ${name}, ${await hashPassword(pw)}) on conflict (email) do nothing returning id`;
  return rows.length > 0;
}
export async function setPassword(id: number, pw: string) {
  const s = await users();
  await s`update admin_users set pass_hash = ${await hashPassword(pw)} where id = ${id}`;
}
export async function removeUser(id: number) {
  const s = await users();
  await s`delete from admin_users where id = ${id}`;
}

/* best-effort brute-force brake (per serverless instance) */
const fails = new Map<string, number[]>();
export function loginBlocked(key: string) {
  const now = Date.now();
  const list = (fails.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  fails.set(key, list);
  return list.length >= 8;
}
export function noteFail(key: string) {
  const list = fails.get(key) || [];
  list.push(Date.now());
  fails.set(key, list);
  if (fails.size > 2000) fails.clear();
}

export async function setName(id: number, name: string) {
  const s = await users();
  await s`update admin_users set name = ${name} where id = ${id}`;
}
export async function checkUserPassword(id: number, pw: string) {
  const s = await users();
  const [u] = await s<{ pass_hash: string }[]>`select pass_hash from admin_users where id = ${id}`;
  return u ? verifyPassword(pw, u.pass_hash) : false;
}
