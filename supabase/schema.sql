-- Run this in the Supabase SQL editor to create the table the contact form writes to.
create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 3 and 320),
  company     text check (char_length(company) <= 200),
  message     text not null check (char_length(message) between 1 and 5000)
);

-- Lock the table down: only the Worker (using the service role key) can read or write it.
alter table public.contact_messages enable row level security;
