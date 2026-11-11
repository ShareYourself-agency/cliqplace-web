import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

/* Admin login – one shared password for the Cliqplace team.
   ENV: ADMIN_PASSWORD (required), ADMIN_SECRET (long random string for signing the session cookie). */

export const COOKIE = 'cq_admin';
const MAX_AGE = 60 * 60 * 12; // 12 h

const secret = () => process.env.ADMIN_SECRET || '';
export const authConfigured = () => Boolean(process.env.ADMIN_PASSWORD && secret().length >= 24);

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return false;
  // compare HMACs so length differences do not leak
  return safeEq(sign(`pw:${input}`), sign(`pw:${pw}`));
}

export function startSession(cookies: AstroCookies, secure: boolean) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `v1.${exp}`;
  cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: MAX_AGE,
  });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export function isAuthed(cookies: AstroCookies) {
  if (!authConfigured()) return false;
  const raw = cookies.get(COOKIE)?.value || '';
  const i = raw.lastIndexOf('.');
  if (i < 0) return false;
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEq(sig, sign(payload))) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp * 1000 > Date.now();
}

/* best-effort brute-force brake (per serverless instance) */
const fails = new Map<string, number[]>();
export function loginBlocked(ip: string) {
  const now = Date.now();
  const list = (fails.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  fails.set(ip, list);
  return list.length >= 8;
}
export function noteFail(ip: string) {
  const list = fails.get(ip) || [];
  list.push(Date.now());
  fails.set(ip, list);
  if (fails.size > 2000) fails.clear();
}
