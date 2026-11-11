import { defineMiddleware } from 'astro:middleware';
import { isAuthed } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (!path.startsWith('/admin') || ctx.isPrerendered) return next();

  const open = path === '/admin/login';
  if (!open && !isAuthed(ctx.cookies)) return ctx.redirect('/admin/login', 303);

  const res = await next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
