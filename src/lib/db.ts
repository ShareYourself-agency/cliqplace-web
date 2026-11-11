import postgres from 'postgres';

/* Lead database (Postgres – e.g. Neon via Vercel → Storage).
   ENV: DATABASE_URL (pooled connection string). Without it the web still works,
   leads then only go by e-mail. */

type Sql = ReturnType<typeof postgres>;
let sql: Sql | null = null;
let ready: Promise<void> | null = null;

export const STATUSES = [
  { id: 'new', label: 'Nový' },
  { id: 'contacted', label: 'Kontaktováno' },
  { id: 'demo', label: 'Demo' },
  { id: 'offer', label: 'Nabídka' },
  { id: 'won', label: 'Vyhráno' },
  { id: 'lost', label: 'Ztraceno' },
] as const;
export type StatusId = (typeof STATUSES)[number]['id'];
export const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label ?? id;
export const isStatus = (v: unknown): v is StatusId => STATUSES.some((s) => s.id === v);

export type Lead = {
  id: number;
  created_at: Date;
  updated_at: Date;
  company: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: StatusId;
  owner: string;
  value: number | null;
  source: string;
  consent_at: Date | null;
};
export type LeadEvent = { id: number; lead_id: number; at: Date; kind: string; text: string };

export const hasDb = () => Boolean(process.env.DATABASE_URL);

export async function db(): Promise<Sql> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      prepare: false, // works with pgbouncer / Neon pooler
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : 'require',
    });
  }
  if (!ready) {
    ready = (async () => {
      await sql!`
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
      await sql!`
        create table if not exists lead_events (
          id serial primary key,
          lead_id integer not null references leads(id) on delete cascade,
          at timestamptz not null default now(),
          kind text not null,
          text text not null default ''
        )`;
      await sql!`create index if not exists lead_events_lead on lead_events(lead_id, at desc)`;
      await sql!`create index if not exists leads_created on leads(created_at desc)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
  return sql;
}

export async function insertLead(l: Pick<Lead, 'company' | 'name' | 'email' | 'phone' | 'message' | 'source'>) {
  const s = await db();
  const [row] = await s<{ id: number }[]>`
    insert into leads (company, name, email, phone, message, source, consent_at)
    values (${l.company}, ${l.name}, ${l.email}, ${l.phone}, ${l.message}, ${l.source}, now())
    returning id`;
  await s`insert into lead_events (lead_id, kind, text) values (${row.id}, 'created', 'Poptávka z webu')`;
  return row.id;
}
