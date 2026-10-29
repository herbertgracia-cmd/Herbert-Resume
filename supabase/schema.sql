-- Herbert Resume: Supabase setup
-- How to use: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run more than once.

-- 1. Contact form messages ------------------------------------------------------
create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 3 and 320),
  company     text check (char_length(company) <= 200),
  message     text not null check (char_length(message) between 1 and 5000),
  is_read     boolean not null default false   -- tick this in the Table Editor once you've replied
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- 2. Questions asked to the "Ask about Herbert" chat ----------------------------
-- Shows what recruiters want to know, so you can improve your resume.
-- No names or emails are stored here.
create table if not exists public.chat_questions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  question    text not null check (char_length(question) between 1 and 500),
  answer      text check (char_length(answer) <= 4000),
  model       text
);

create index if not exists chat_questions_created_at_idx
  on public.chat_questions (created_at desc);

-- Anonymous visitor id (a hash, never an IP address), used to cap questions per hour.
alter table public.chat_questions add column if not exists visitor text;
create index if not exists chat_questions_visitor_idx
  on public.chat_questions (visitor, created_at desc);

-- 3. Welcome pop-up answers ("What brings you here?") ---------------------------
-- Who visited and how Herbert can help. Only filled in when a visitor chooses to answer.
create table if not exists public.visitor_intros (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  reason      text not null check (reason in ('hiring', 'project', 'collab', 'looking')),
  name        text check (char_length(name) <= 200),
  email       text check (char_length(email) <= 320),
  company     text check (char_length(company) <= 200),
  title       text check (char_length(title) <= 200),
  message     text check (char_length(message) <= 2000),
  referrer    text check (char_length(referrer) <= 500),
  is_read     boolean not null default false
);

create index if not exists visitor_intros_created_at_idx
  on public.visitor_intros (created_at desc);

-- 4. Security --------------------------------------------------------------------
-- Row Level Security is on with no policies, so the public "anon" key can't read
-- or write these tables. Only the website's server (using the service_role key,
-- stored as a Cloudflare secret) can.
alter table public.contact_messages enable row level security;
alter table public.chat_questions   enable row level security;
alter table public.visitor_intros   enable row level security;

revoke all on public.contact_messages from anon, authenticated;
revoke all on public.chat_questions   from anon, authenticated;
revoke all on public.visitor_intros   from anon, authenticated;
