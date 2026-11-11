import postgres from 'postgres';

/* Cliqplace CRM – Postgres (Neon via Vercel → Storage). ENV: DATABASE_URL.
   Schema is created / migrated automatically (idempotent) on first use per instance. */

type Sql = ReturnType<typeof postgres>;
let sql: Sql | null = null;
let ready: Promise<void> | null = null;

/* ---------- pipeline ---------- */
export const STAGES = [
  { id: 'new', label: 'Nový', p: 10 },
  { id: 'contacted', label: 'Osloveno', p: 20 },
  { id: 'demo', label: 'Demo / schůzka', p: 40 },
  { id: 'offer', label: 'Nabídka', p: 60 },
  { id: 'negotiation', label: 'Vyjednávání', p: 80 },
  { id: 'won', label: 'Vyhráno', p: 100 },
  { id: 'lost', label: 'Prohráno', p: 0 },
] as const;
export const STATUSES = STAGES; // backwards compat
export type StageId = (typeof STAGES)[number]['id'];
export const OPEN_STAGES = STAGES.filter((s) => s.id !== 'won' && s.id !== 'lost').map((s) => s.id);
export const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;
export const statusLabel = stageLabel;
export const stageProb = (id: string) => STAGES.find((s) => s.id === id)?.p ?? 0;
export const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);
export const isStatus = isStage;

export const SEGMENTS = ['Kino', 'Divadlo', 'Kulturní dům / centrum', 'Festival / koncerty', 'Památka / muzeum', 'Sport', 'Klub / bar', 'Město / obec', 'Jiné'];
export const PRODUCTS = ['Software Entradio', 'Hardware', 'Prodejní portál', 'Vlastní web / white-label', 'Pokladna na místě', 'Odbavení u vstupu'];
export const SOURCES = ['Web – formulář', 'Telefon', 'E-mail', 'Doporučení', 'Veletrh / akce', 'Obchodník – aktivně', 'Jiné'];
export const LOST_REASONS = ['Cena', 'Zůstali u stávajícího řešení', 'Vybrali konkurenci', 'Nereagují', 'Nevhodný klient', 'Odloženo', 'Jiné'];
export const ACTIVITY_KINDS = [
  { id: 'note', label: 'Poznámka' },
  { id: 'call', label: 'Telefonát' },
  { id: 'email', label: 'E-mail' },
  { id: 'meeting', label: 'Schůzka' },
  { id: 'demo', label: 'Demo' },
  { id: 'offer', label: 'Nabídka odeslána' },
] as const;
export const OUTREACH = new Set(['call', 'email', 'meeting', 'demo', 'offer']);
export const kindLabel = (k: string) =>
  ACTIVITY_KINDS.find((a) => a.id === k)?.label ??
  ({ status: 'Změna fáze', created: 'Vytvořeno', task: 'Úkol', task_done: 'Úkol splněn', edit: 'Úprava', assign: 'Přiřazení', import: 'Import' } as Record<string, string>)[k] ??
  k;

export type Lead = {
  id: number;
  created_at: Date;
  updated_at: Date;
  company: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: StageId;
  owner_id: number | null;
  owner_name?: string | null;
  value: number | null;
  probability: number | null;
  expected_close: Date | null;
  source: string;
  consent_at: Date | null;
  ico: string;
  website: string;
  city: string;
  segment: string;
  position: string;
  needs: string;
  products: string[];
  current_solution: string;
  capacity: string;
  next_step: string;
  next_step_at: Date | null;
  first_contact_at: Date | null;
  last_activity_at: Date | null;
  last_step: string;
  lost_reason: string;
  tags: string[];
};
export type LeadEvent = { id: number; lead_id: number; at: Date; kind: string; text: string; user_id: number | null; user_name?: string | null };
export type Task = {
  id: number;
  lead_id: number;
  title: string;
  due_at: Date | null;
  done_at: Date | null;
  user_id: number | null;
  user_name?: string | null;
  created_at: Date;
  company?: string;
  lead_name?: string;
};

export const hasDb = () => Boolean(process.env.DATABASE_URL);

async function migrate(s: Sql) {
  await s`
    create table if not exists leads (
      id serial primary key,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      company text not null default '',
      name text not null default '',
      email text not null default '',
      phone text not null default '',
      message text not null default '',
      status text not null default 'new',
      owner text not null default '',
      value integer,
      source text not null default '',
      consent_at timestamptz
    )`;
  // CRM columns (idempotent)
  await s.unsafe(`
    alter table leads
      add column if not exists owner_id integer,
      add column if not exists probability integer,
      add column if not exists expected_close date,
      add column if not exists ico text not null default '',
      add column if not exists website text not null default '',
      add column if not exists city text not null default '',
      add column if not exists segment text not null default '',
      add column if not exists position text not null default '',
      add column if not exists needs text not null default '',
      add column if not exists products text[] not null default '{}',
      add column if not exists current_solution text not null default '',
      add column if not exists capacity text not null default '',
      add column if not exists next_step text not null default '',
      add column if not exists next_step_at timestamptz,
      add column if not exists first_contact_at timestamptz,
      add column if not exists last_activity_at timestamptz,
      add column if not exists last_step text not null default '',
      add column if not exists lost_reason text not null default '',
      add column if not exists tags text[] not null default '{}',
      add column if not exists deleted_at timestamptz
  `);
  await s`
    create table if not exists lead_events (
      id serial primary key,
      lead_id integer not null references leads(id) on delete cascade,
      at timestamptz not null default now(),
      kind text not null,
      text text not null default ''
    )`;
  await s.unsafe(`alter table lead_events add column if not exists user_id integer`);
  await s`
    create table if not exists tasks (
      id serial primary key,
      lead_id integer not null references leads(id) on delete cascade,
      title text not null,
      due_at timestamptz,
      done_at timestamptz,
      user_id integer,
      created_by integer,
      created_at timestamptz not null default now()
    )`;
  await s`create index if not exists lead_events_lead on lead_events(lead_id, at desc)`;
  await s`create index if not exists leads_created on leads(created_at desc)`;
  await s`create index if not exists leads_status on leads(status)`;
  await s`create index if not exists tasks_open on tasks(due_at) where done_at is null`;
  await s`create index if not exists tasks_lead on tasks(lead_id)`;
  // backfill stage for old data
  await s`update leads set status = 'new' where status not in ('new','contacted','demo','offer','negotiation','won','lost')`;
}

export async function db(): Promise<Sql> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // pgbouncer / Neon pooler
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : 'require',
    });
  }
  if (!ready) {
    ready = migrate(sql).catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
  return sql;
}

/* ---------- writes used across pages ---------- */
export async function logEvent(leadId: number, kind: string, text: string, userId: number | null) {
  const s = await db();
  await s`insert into lead_events (lead_id, kind, text, user_id) values (${leadId}, ${kind}, ${text}, ${userId})`;
}

export async function insertLead(
  l: Partial<Pick<Lead, 'company' | 'name' | 'email' | 'phone' | 'message' | 'source' | 'segment' | 'city' | 'needs' | 'position' | 'website' | 'ico'>> & { owner_id?: number | null; status?: string; created_at?: string },
  opts: { userId?: number | null; consent?: boolean; eventText?: string } = {},
) {
  const s = await db();
  const [row] = await s<{ id: number }[]>`
    insert into leads (company, name, email, phone, message, source, segment, city, needs, position, website, ico, owner_id, status, consent_at, created_at, last_activity_at)
    values (${l.company ?? ''}, ${l.name ?? ''}, ${l.email ?? ''}, ${l.phone ?? ''}, ${l.message ?? ''}, ${l.source ?? ''}, ${l.segment ?? ''},
            ${l.city ?? ''}, ${l.needs ?? ''}, ${l.position ?? ''}, ${l.website ?? ''}, ${l.ico ?? ''}, ${l.owner_id ?? null},
            ${isStage(l.status) ? l.status : 'new'}, ${opts.consent ? s`now()` : null}, ${l.created_at ? new Date(l.created_at) : s`now()`}, now())
    returning id`;
  await s`insert into lead_events (lead_id, kind, text, user_id) values (${row.id}, 'created', ${opts.eventText ?? 'Poptávka z webu'}, ${opts.userId ?? null})`;
  return row.id;
}

export async function updateLead(id: number, patch: Record<string, unknown>) {
  const s = await db();
  const allowed = [
    'company', 'name', 'email', 'phone', 'position', 'ico', 'website', 'city', 'segment', 'needs', 'products', 'current_solution', 'capacity',
    'value', 'probability', 'expected_close', 'source', 'next_step', 'next_step_at', 'lost_reason', 'tags', 'owner_id', 'status',
    'first_contact_at', 'last_activity_at', 'last_step', 'deleted_at',
  ];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(clean).length) return;
  await s`update leads set ${s(clean)}, updated_at = now() where id = ${id}`;
}
