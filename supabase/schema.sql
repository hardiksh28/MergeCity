-- MergeCity on Supabase.
-- Emails live only in auth.users + private tables. The city reads the
-- `public_residents` view, which exposes handle, look, plot, tier, floors
-- and the GitHub username the resident chose to connect. Nothing else.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- plots
-- Seed this from the same layout the client builds (src/lib/city.ts).
-- `ord` is the fill order: closest to HQ first, so the city grows outward.
create table public.plots (
  id          text primary key,            -- 'os-27', 'ms-4'
  district    text not null check (district in ('outskirts','mainstreet')),
  num         int  not null,
  ord         int  not null,
  x           real not null,
  z           real not null,
  occupied_by uuid unique
);
create index plots_free_idx on public.plots (district, ord) where occupied_by is null;

-- ------------------------------------------------------------ residents
create table public.residents (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  handle      text not null check (char_length(handle) between 1 and 20),
  github      text,                          -- only if the user connected it
  look        jsonb not null,                -- { outfit, skin, head }
  tier        text not null default 'free' check (tier in ('free','founder','team')),
  floors      int  not null default 1 check (floors between 1 and 5),
  plot_id     text references public.plots(id),
  place       bigint generated always as identity,
  hidden      boolean not null default false,   -- admin moderation
  created_at  timestamptz not null default now()
);

-- Everything in `residents` is safe to show the city (no email, no codes),
-- so it can be streamed over Realtime. Private bits live here.
create table public.resident_private (
  user_id     uuid primary key references public.residents(user_id) on delete cascade,
  ref_code    text not null unique default substr(encode(gen_random_bytes(6), 'hex'), 1, 8),
  referred_by uuid references public.residents(user_id)
);

create table public.referrals (
  referrer_id uuid not null references public.residents(user_id) on delete cascade,
  referred_id uuid primary key references public.residents(user_id) on delete cascade,
  verified_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.residents(user_id),
  amount      numeric(10,2) not null,
  gateway_id  text not null unique,           -- idempotency for webhook retries
  status      text not null,
  type        text not null check (type in ('founder','subscription')),
  created_at  timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 20),
  tower_id    text not null unique,           -- 'T-07'
  seats       int  not null check (seats > 0),
  owner_id    uuid references public.residents(user_id),
  gateway_id  text unique,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ public view
create view public.public_residents with (security_invoker = false) as
  select r.user_id as id, r.handle, r.github, r.look, r.tier, r.floors, r.plot_id, r.place, r.created_at
  from public.residents r
  where not r.hidden;

grant select on public.public_residents to anon, authenticated;
grant select (id, name, tower_id, seats) on public.teams to anon, authenticated;

alter table public.residents enable row level security;
alter table public.resident_private enable row level security;
alter table public.referrals enable row level security;
alter table public.payments  enable row level security;
alter table public.teams     enable row level security;
alter table public.plots     enable row level security;

create policy "city can see residents" on public.residents for select using (not hidden);
create policy "own private row" on public.resident_private for select using (auth.uid() = user_id);
create policy "own payments" on public.payments for select using (auth.uid() = user_id);
create policy "teams public" on public.teams for select using (true);
create policy "plots public" on public.plots for select using (true);
-- No insert/update policies: all writes go through the security-definer functions below.

-- ---------------------------------------------------------------- join
-- Called right after email verification (OTP or magic link) succeeds.
create or replace function public.move_in(p_handle text, p_github text, p_look jsonb, p_ref text)
returns public.public_residents
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_plot text;
  v_referrer uuid;
  out_row public.public_residents;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (select email_confirmed_at from auth.users where id = uid) is null then
    raise exception 'verify your email first';
  end if;
  if exists (select 1 from residents where user_id = uid) then
    select * into out_row from public_residents where id = uid; return out_row;
  end if;

  -- Next free plot, locked so two people can't get the same one.
  select id into v_plot from plots
   where district = 'outskirts' and occupied_by is null
   order by ord limit 1 for update skip locked;
  if v_plot is null then raise exception 'city full'; end if;

  select user_id into v_referrer from resident_private where ref_code = p_ref;

  insert into residents (user_id, handle, github, look, plot_id)
  values (uid, p_handle, nullif(p_github, ''), p_look, v_plot);
  insert into resident_private (user_id, referred_by) values (uid, v_referrer);
  update plots set occupied_by = uid where id = v_plot;

  -- The referral only counts now, after verification.
  if v_referrer is not null and v_referrer <> uid then
    insert into referrals (referrer_id, referred_id) values (v_referrer, uid) on conflict do nothing;
    update residents set floors = least(5, floors + 1) where user_id = v_referrer;
  end if;

  select * into out_row from public_residents where id = uid;
  return out_row;
end $$;

-- ------------------------------------------------------ payment grants
-- Only callable with the service-role key (from the webhook route).
create or replace function public.grant_founder(p_user_id uuid, p_gateway_id text, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_plot text;
begin
  insert into payments (user_id, amount, gateway_id, status, type)
  values (p_user_id, p_amount, p_gateway_id, 'captured', 'founder')
  on conflict (gateway_id) do nothing;
  if not found then return; end if;  -- webhook retry, already granted

  if (select tier from residents where user_id = p_user_id) = 'free' then
    select id into v_plot from plots
     where district = 'mainstreet' and occupied_by is null
     order by ord limit 1 for update skip locked;
    if v_plot is null then return; end if;  -- Main Street full: keep the credit, move later
    update plots set occupied_by = null where occupied_by = p_user_id;
    update plots set occupied_by = p_user_id where id = v_plot;
    update residents set tier = 'founder', plot_id = v_plot where user_id = p_user_id;
  end if;
end $$;

create or replace function public.grant_tower(p_user_id uuid, p_gateway_id text, p_tower_id text, p_team_name text, p_seats int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into teams (name, tower_id, seats, owner_id, gateway_id)
  values (p_team_name, p_tower_id, p_seats, p_user_id, p_gateway_id)
  on conflict (gateway_id) do update set seats = excluded.seats;
  update residents set tier = 'team' where user_id = p_user_id and tier = 'free';
end $$;

create or replace function public.release_tower(p_gateway_id text)
returns void language sql security definer set search_path = public as $$
  delete from teams where gateway_id = p_gateway_id;
$$;

revoke all on function public.grant_founder, public.grant_tower, public.release_tower from anon, authenticated;
grant execute on function public.move_in to authenticated;

-- ------------------------------------------------------------ realtime
-- New houses appear live for everyone.
alter publication supabase_realtime add table public.residents, public.teams;

-- ------------------------------------------------------------ rate limits
-- Supabase Auth already rate-limits OTP emails per address and per IP
-- (Dashboard -> Auth -> Rate Limits). Keep "Confirm email" ON.
