import type { APIRoute } from 'astro';
import { endSession } from '../../lib/auth';
export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  endSession(cookies);
  return redirect('/admin/login', 303);
};
