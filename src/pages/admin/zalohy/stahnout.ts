import type { APIRoute } from 'astro';
import { readBackup } from '../../../lib/backup';
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const path = url.searchParams.get('path') || '';
  try {
    const buf = await readBackup(path);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${path.replace('backups/', '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Záloha nenalezena.', { status: 404 });
  }
};
