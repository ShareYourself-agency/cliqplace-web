import { db, isStage, kindLabel, logEvent, OUTREACH, stageLabel, stageProb, updateLead, LOST_REASONS, PRODUCTS, type Lead } from './db';
import { czk, fmtDate, fromLocalInput } from './format';

/** "Další krok" = the earliest open task of the lead */
export async function recomputeNext(leadId: number) {
  const s = await db();
  const [t] = await s<{ title: string; due_at: Date | null }[]>`
    select title, due_at from tasks where lead_id = ${leadId} and done_at is null
    order by due_at asc nulls last, created_at asc limit 1`;
  await s`update leads set next_step = ${t?.title ?? ''}, next_step_at = ${t?.due_at ?? null} where id = ${leadId}`;
}

export async function getLead(id: number) {
  const s = await db();
  const [l] = await s<Lead[]>`
    select l.*, u.name as owner_name, u.email as owner_email
    from leads l left join admin_users u on u.id = l.owner_id where l.id = ${id}`;
  return l || null;
}

export const safeRedirect = (v: unknown, fallback: string) => {
  const s = String(v || '');
  return s.startsWith('/admin') && !s.startsWith('//') ? s : fallback;
};

const FIELD_LABELS: Record<string, string> = {
  company: 'firma', name: 'kontaktní osoba', email: 'e-mail', phone: 'telefon', position: 'pozice', ico: 'IČO', website: 'web', city: 'město',
  segment: 'typ provozu', needs: 'co klient chce', products: 'zájem o', current_solution: 'stávající řešení', capacity: 'velikost / kapacita',
  value: 'hodnota', probability: 'pravděpodobnost', expected_close: 'očekávané uzavření', source: 'zdroj', lost_reason: 'důvod prohry', tags: 'štítky',
};

/** Handles every POST on the lead detail (also used by pipeline + task list). Returns redirect URL. */
export async function handleLeadAction(id: number, fd: FormData, userId: number, userName: string): Promise<string> {
  const s = await db();
  const action = String(fd.get('action') || '');
  const back = safeRedirect(fd.get('redirect'), `/admin/lead/${id}`);
  const lead = await getLead(id);
  if (!lead) return '/admin/leady';
  const str = (k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max);

  switch (action) {
    case 'stage': {
      const next = str('status');
      if (!isStage(next) || next === lead.status) break;
      const patch: Record<string, unknown> = { status: next };
      if (next !== 'new' && !lead.first_contact_at) patch.first_contact_at = new Date();
      if (next === 'lost' && fd.get('lost_reason')) patch.lost_reason = str('lost_reason', 120);
      await updateLead(id, patch);
      await logEvent(id, 'status', `${stageLabel(lead.status)} → ${stageLabel(next)}${patch.lost_reason ? ` (${patch.lost_reason})` : ''}`, userId);
      break;
    }
    case 'activity': {
      const kind = str('kind', 20) || 'note';
      const text = str('text', 5000);
      const nextTitle = str('next_title', 300);
      const nextAt = fromLocalInput(str('next_at', 20));
      if (!text && !nextTitle) break;
      if (text) {
        await logEvent(id, kind, text, userId);
        const patch: Record<string, unknown> = { last_activity_at: new Date(), last_step: `${kindLabel(kind)}: ${text.replace(/\s+/g, ' ').slice(0, 140)}` };
        if (OUTREACH.has(kind)) {
          if (!lead.first_contact_at) patch.first_contact_at = new Date();
          if (lead.status === 'new') {
            patch.status = 'contacted';
            await logEvent(id, 'status', `${stageLabel('new')} → ${stageLabel('contacted')} (automaticky po prvním kontaktu)`, userId);
          }
        }
        await updateLead(id, patch);
      }
      if (nextTitle) {
        await s`insert into tasks (lead_id, title, due_at, user_id, created_by) values (${id}, ${nextTitle}, ${nextAt}, ${lead.owner_id ?? userId}, ${userId})`;
        await logEvent(id, 'task', `Naplánováno: ${nextTitle}${nextAt ? ` · ${fmtDate(nextAt)}` : ''}`, userId);
        await recomputeNext(id);
      }
      break;
    }
    case 'contacted': {
      if (!lead.first_contact_at) {
        const patch: Record<string, unknown> = { first_contact_at: new Date() };
        if (lead.status === 'new') patch.status = 'contacted';
        await updateLead(id, patch);
        await logEvent(id, 'status', 'Označeno jako osloveno', userId);
      }
      break;
    }
    case 'task_add': {
      const title = str('title', 300);
      if (!title) break;
      const due = fromLocalInput(str('due_at', 20));
      const uid = Number(fd.get('user_id')) || lead.owner_id || userId;
      await s`insert into tasks (lead_id, title, due_at, user_id, created_by) values (${id}, ${title}, ${due}, ${uid}, ${userId})`;
      await logEvent(id, 'task', `Úkol: ${title}${due ? ` · ${fmtDate(due)}` : ''}`, userId);
      await recomputeNext(id);
      break;
    }
    case 'task_toggle': {
      const tid = Number(fd.get('task_id'));
      const [t] = await s<{ title: string; done_at: Date | null }[]>`select title, done_at from tasks where id = ${tid} and lead_id = ${id}`;
      if (!t) break;
      if (t.done_at) await s`update tasks set done_at = null where id = ${tid}`;
      else {
        await s`update tasks set done_at = now() where id = ${tid}`;
        await logEvent(id, 'task_done', `Splněno: ${t.title}`, userId);
        await updateLead(id, { last_activity_at: new Date(), last_step: `Splněno: ${t.title.slice(0, 140)}` });
      }
      await recomputeNext(id);
      break;
    }
    case 'task_delete': {
      await s`delete from tasks where id = ${Number(fd.get('task_id'))} and lead_id = ${id}`;
      await recomputeNext(id);
      break;
    }
    case 'assign': {
      const raw = String(fd.get('owner_id') || '');
      const owner = raw ? Number(raw) : null;
      if (owner === lead.owner_id) break;
      let who = 'nikdo';
      if (owner) {
        const [u] = await s<{ name: string; email: string }[]>`select name, email from admin_users where id = ${owner}`;
        if (!u) break;
        who = u.name || u.email;
      }
      await updateLead(id, { owner_id: owner });
      // open tasks follow the owner unless explicitly assigned to someone else
      if (owner) await s`update tasks set user_id = ${owner} where lead_id = ${id} and done_at is null and (user_id is null or user_id = ${lead.owner_id})`;
      await logEvent(id, 'assign', `Řeší: ${who}`, userId);
      break;
    }
    case 'update': {
      const patch: Record<string, unknown> = {};
      const changed: string[] = [];
      for (const k of ['company', 'name', 'email', 'phone', 'position', 'ico', 'website', 'city', 'segment', 'source', 'current_solution', 'capacity', 'lost_reason']) {
        if (fd.has(k)) patch[k] = str(k, 300);
      }
      if (fd.has('needs')) patch.needs = str('needs', 5000);
      if (fd.has('value')) { const v = str('value').replace(/[^\d]/g, '').slice(0, 10); patch.value = v ? Number(v) : null; }
      if (fd.has('probability')) { const v = str('probability').replace(/[^\d]/g, ''); patch.probability = v === '' ? null : Math.min(100, Number(v)); }
      if (fd.has('expected_close')) patch.expected_close = str('expected_close') || null;
      if (fd.has('products__present')) patch.products = fd.getAll('products').map(String).filter((p) => PRODUCTS.includes(p));
      if (fd.has('tags')) patch.tags = str('tags', 300).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
      if (patch.lost_reason && !LOST_REASONS.includes(String(patch.lost_reason))) patch.lost_reason = String(patch.lost_reason).slice(0, 120);
      for (const [k, v] of Object.entries(patch)) {
        const old = (lead as Record<string, unknown>)[k];
        const norm = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : Array.isArray(x) ? x.join(',') : x ?? '');
        if (String(norm(old)) !== String(norm(v))) changed.push(k === 'value' ? `hodnota ${czk(v as number)}` : k === 'probability' ? `pravděpodobnost ${v ?? stageProb(lead.status)} %` : FIELD_LABELS[k] || k);
      }
      if (!changed.length) break;
      await updateLead(id, patch);
      await logEvent(id, 'edit', `Upraveno: ${changed.join(', ')}`, userId);
      break;
    }
    case 'delete': {
      await updateLead(id, { deleted_at: new Date() });
      await logEvent(id, 'edit', `Přesunuto do koše (${userName})`, userId);
      return '/admin/leady';
    }
    case 'restore': {
      await updateLead(id, { deleted_at: null });
      await logEvent(id, 'edit', 'Obnoveno z koše', userId);
      break;
    }
  }
  return back;
}
