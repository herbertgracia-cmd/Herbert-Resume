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

-- 3. Security --------------------------------------------------------------------
-- Row Level Security is on with no policies, so the public "anon" key can't read
-- or write these tables. Only the website's server (using the service_role key,
-- stored as a Cloudflare secret) can.
alter table public.contact_messages enable row level security;
alter table public.chat_questions   enable row level security;

revoke all on public.contact_messages from anon, authenticated;
revoke all on public.chat_questions   from anon, authenticated;
