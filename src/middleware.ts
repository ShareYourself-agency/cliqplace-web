import { defineMiddleware } from 'astro:middleware';
import { currentUser } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (!path.startsWith('/admin') || ctx.isPrerendered) return next();

  if (path !== '/admin/login') {
    let user = null;
    try {
      user = await currentUser(ctx.cookies);
    } catch (e) {
      console.error('[admin] session check failed', e);
    }
    if (!user) return ctx.redirect('/admin/login', 303);
    ctx.locals.user = user;
  }

  const res = await next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
