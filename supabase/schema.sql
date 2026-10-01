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
  currency    text not null default 'USD',
  gateway_id  text not null unique,           -- 'upi:<UTR>' / 'paypal:<txn id>'; stops double grants
  status      text not null,
  type        text not null check (type in ('founder','subscription')),
  created_at  timestamptz not null default now()
);

-- "I paid, here's my transaction ID." Checked by hand, then approved or rejected.
create table public.payment_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.residents(user_id) on delete cascade,
  method      text not null check (method in ('upi','paypal')),
  txn_id      text not null,
  amount      numeric(10,2) not null,
  currency    text not null check (currency in ('INR','USD')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
-- The same transaction ID can't be claimed twice (unless an earlier claim was rejected).
create unique index payment_claims_txn on public.payment_claims (txn_id) where status <> 'rejected';
-- One claim waiting per person.
create unique index payment_claims_one_pending on public.payment_claims (user_id) where status = 'pending';

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
-- Explicit grants, so this works with "Automatically expose new tables" turned OFF.
-- RLS policies below still decide which rows each role can see.
grant select on public.residents, public.plots to anon, authenticated;
grant select on public.resident_private, public.payments, public.payment_claims to authenticated;
grant all on all tables in schema public to service_role;

alter table public.residents enable row level security;
alter table public.resident_private enable row level security;
alter table public.referrals enable row level security;
alter table public.payments  enable row level security;
alter table public.teams     enable row level security;
alter table public.plots     enable row level security;
alter table public.payment_claims enable row level security;

create policy "city can see residents" on public.residents for select using (not hidden);
create policy "own private row" on public.resident_private for select using (auth.uid() = user_id);
create policy "own payments" on public.payments for select using (auth.uid() = user_id);
create policy "own claims" on public.payment_claims for select using (auth.uid() = user_id);
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

-- ------------------------------------------------------- edit my house
-- Residents can change their own door name, GitHub and character. Nothing else.
create or replace function public.update_my_house(p_handle text, p_github text, p_look jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_github is not null and p_github <> '' and p_github !~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$' then
    raise exception 'That GitHub username isn''t valid.';
  end if;
  update residents set
    handle = coalesce(nullif(trim(p_handle), ''), handle),
    github = nullif(trim(p_github), ''),
    look   = coalesce(p_look, look)
  where user_id = auth.uid();
end $$;

-- ------------------------------------------------------ payment grants
-- Only callable with the service-role key (from the webhook route).
create or replace function public.grant_founder(p_user_id uuid, p_gateway_id text, p_amount numeric, p_currency text default 'USD')
returns void language plpgsql security definer set search_path = public as $$
declare v_plot text;
begin
  insert into payments (user_id, amount, currency, gateway_id, status, type)
  values (p_user_id, p_amount, p_currency, p_gateway_id, 'succeeded', 'founder')
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

-- ------------------------------------------------------ manual payments
-- The buyer submits their UPI reference / PayPal transaction ID. Grants nothing.
create or replace function public.submit_payment_claim(p_method text, p_txn_id text)
returns public.payment_claims
language plpgsql security definer set search_path = public as $$
declare
  v_txn text := upper(regexp_replace(coalesce(p_txn_id, ''), '\s', '', 'g'));
  v_row payment_claims;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if (select tier from residents where user_id = auth.uid()) is distinct from 'free' then
    raise exception 'You''re already a founding resident.';
  end if;
  if p_method = 'upi' and v_txn !~ '^[0-9]{12}$' then raise exception 'A UPI reference (UTR) is 12 digits.'; end if;
  if p_method = 'paypal' and v_txn !~ '^[A-Z0-9]{17}$' then raise exception 'A PayPal transaction ID is 17 letters and numbers.'; end if;
  if p_method not in ('upi','paypal') then raise exception 'Unknown payment method.'; end if;

  insert into payment_claims (user_id, method, txn_id, amount, currency)
  values (auth.uid(), p_method, v_txn,
          case when p_method = 'upi' then 169 else 2 end,   -- keep in sync with src/lib/pricing.ts
          case when p_method = 'upi' then 'INR' else 'USD' end)
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'That transaction ID was already submitted, or you already have a payment waiting to be checked.';
end $$;

-- You found the money in your bank / PayPal: grant the upgrade. Admin only.
create or replace function public.approve_payment_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c payment_claims;
begin
  select * into c from payment_claims where id = p_claim_id and status = 'pending' for update;
  if not found then return; end if;
  perform grant_founder(c.user_id, c.method || ':' || c.txn_id, c.amount, c.currency);
  update payment_claims set status = 'approved', reviewed_at = now() where id = c.id;
end $$;

create or replace function public.reject_payment_claim(p_claim_id uuid)
returns void language sql security definer set search_path = public as $$
  update payment_claims set status = 'rejected', reviewed_at = now() where id = p_claim_id and status = 'pending';
$$;

revoke all on function public.submit_payment_claim, public.approve_payment_claim, public.reject_payment_claim from public, anon, authenticated;
grant execute on function public.submit_payment_claim to authenticated;
grant execute on function public.approve_payment_claim, public.reject_payment_claim to service_role;

-- Postgres lets PUBLIC execute new functions by default; revoking only from
-- anon/authenticated would leave that open. Payment grants are server-only.
revoke all on function public.grant_founder, public.grant_tower, public.release_tower from public, anon, authenticated;
grant execute on function public.grant_founder, public.grant_tower, public.release_tower to service_role;
revoke all on function public.move_in from public, anon;
grant execute on function public.move_in to authenticated;
revoke all on function public.update_my_house from public, anon;
grant execute on function public.update_my_house to authenticated;

-- ------------------------------------------------------------ realtime
-- New houses appear live for everyone.
alter publication supabase_realtime add table public.residents, public.teams;

-- ------------------------------------------------------------ rate limits
-- Supabase Auth already rate-limits OTP emails per address and per IP
-- (Dashboard -> Auth -> Rate Limits). Keep "Confirm email" ON.
