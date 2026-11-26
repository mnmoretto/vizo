-- ============================================================================
-- Vizo — Schema Inicial do Banco de Dados (Supabase / PostgreSQL)
-- Etapa 1: Perfis de usuários, papéis (morador/sindico), onboarding e RLS
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Tipo enumerado para papel do usuário no condomínio
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('morador', 'sindico');
  end if;
end $$;

-- 2. Tabela de perfis vinculada ao auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  cpf text unique,
  phone text,
  block text,
  unit text,
  role public.user_role not null default 'morador',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cpf_digits_check check (cpf is null or cpf ~ '^[0-9]{11}$'),
  constraint phone_digits_check check (phone is null or phone ~ '^[0-9]{10,11}$')
);

comment on table public.profiles is 'Perfis dos moradores e síndicos do Vizo.';
comment on column public.profiles.role is 'Papel do usuário no condomínio: morador (padrão) ou sindico.';
comment on column public.profiles.onboarding_completed is 'Controla o onboarding obrigatório no primeiro acesso.';

-- 3. Função e trigger para manter updated_at sempre atualizado
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 4. Função e trigger para criar automaticamente o perfil com role='morador'
--    sempre que um usuário se cadastrar (E-mail/Senha ou Google OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'morador',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Helper seguro para verificar se o usuário autenticado é síndico
create or replace function public.is_sindico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'sindico'
  );
$$;

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Usuário vê o próprio perfil; síndico pode visualizar todos os perfis do condomínio
drop policy if exists "Perfis: leitura própria ou síndico" on public.profiles;
create policy "Perfis: leitura própria ou síndico"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_sindico());

-- Usuário só pode inserir o próprio perfil e sempre como 'morador'
drop policy if exists "Perfis: inserção própria como morador" on public.profiles;
create policy "Perfis: inserção própria como morador"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
    and role = 'morador'
  );

-- Usuário pode atualizar o próprio perfil, sem poder promover a própria role
drop policy if exists "Perfis: atualização própria sem alterar role" on public.profiles;
create policy "Perfis: atualização própria sem alterar role"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 7. Bucket de Storage preparado para fotos de ocorrências e vistorias (Etapa 2)
insert into storage.buckets (id, name, public)
values ('occurrences-media', 'occurrences-media', false)
on conflict (id) do nothing;
