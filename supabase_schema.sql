-- ============================================
-- DK Attack Planner – Supabase SQL Schema
-- Spusť v Supabase SQL Editoru
-- ============================================

-- Rozšíření pro UUID
create extension if not exists "uuid-ossp";

-- Tabulka profilů hráčů (navazuje na auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  player_name text,
  role text not null default 'player' check (role in ('commander', 'player')),
  created_at timestamptz default now()
);

-- Tabulka plánů
create table public.plans (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.profiles(id) on delete cascade,
  label text not null,
  world text not null default 'cs112',
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabulka přiřazení plánů hráčům
create table public.plan_assignments (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid references public.plans(id) on delete cascade,
  player_email text not null,
  player_name text not null,
  rows_data jsonb not null,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_assignments enable row level security;

-- Profiles: každý vidí jen svůj profil
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Plans: velitel vidí/upravuje své plány, hráči nic
create policy "Commander owns plans" on public.plans
  for all using (auth.uid() = created_by);

-- Assignments: velitel spravuje, hráč vidí jen svoje
create policy "Commander manages assignments" on public.plan_assignments
  for all using (
    exists (
      select 1 from public.plans p
      where p.id = plan_assignments.plan_id
      and p.created_by = auth.uid()
    )
  );

create policy "Player sees own assignments" on public.plan_assignments
  for select using (
    player_email = (
      select email from public.profiles where id = auth.uid()
    )
  );

-- ============================================
-- Trigger: při registraci vytvoř profil
-- ============================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'tomas.neitzel@gmail.com' then 'commander' else 'player' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- POZOR: Nahraď 'vas@email.cz' svým emailem!
-- ============================================
