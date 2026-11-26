-- ============================================================================
-- Vizo — Etapa 2: Ocorrências, Histórico (Timeline) e Fotos (Storage)
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele é idempotente (pode ser executado com segurança mais de uma vez).

-- 0. Garantir permissões explícitas na tabela profiles (Etapa 1)
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

-- 1. Tipo enumerado de status das ocorrências
do $$
begin
  if not exists (select 1 from pg_type where typname = 'occurrence_status') then
    create type public.occurrence_status as enum ('aberto', 'resolvido', 'cancelado');
  end if;
end $$;

-- 2. Tabela principal de ocorrências
create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  protocol text unique not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room text not null,
  description text not null,
  status public.occurrence_status not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint occurrence_room_not_empty check (char_length(btrim(room)) >= 2),
  constraint occurrence_description_min_length check (char_length(btrim(description)) >= 100)
);

comment on table public.occurrences is 'Ocorrências e vistorias registradas pelos moradores no Vizo.';
comment on column public.occurrences.protocol is 'Código único legível no formato VIZ-AAAA-NNNN.';

create index if not exists idx_occurrences_user_created
  on public.occurrences (user_id, created_at desc);

create index if not exists idx_occurrences_status
  on public.occurrences (status);

-- 3. Gerador automático de código de protocolo único (ex: VIZ-2026-8492)
create or replace function public.generate_occurrence_protocol()
returns trigger
language plpgsql
as $$
declare
  year_part text;
  candidate text;
  attempts int := 0;
begin
  if new.protocol is not null and btrim(new.protocol) <> '' then
    return new;
  end if;

  year_part := to_char(coalesce(new.created_at, now()) at time zone 'America/Sao_Paulo', 'YYYY');

  loop
    attempts := attempts + 1;
    candidate := 'VIZ-' || year_part || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

    exit when not exists (
      select 1 from public.occurrences where protocol = candidate
    );

    if attempts >= 30 then
      -- Fallback de 6 dígitos em caso raro de muitas ocorrências no mesmo ano
      candidate := 'VIZ-' || year_part || '-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      exit when not exists (
        select 1 from public.occurrences where protocol = candidate
      );
    end if;
  end loop;

  new.protocol := candidate;
  return new;
end;
$$;

drop trigger if exists set_occurrence_protocol on public.occurrences;
create trigger set_occurrence_protocol
  before insert on public.occurrences
  for each row
  execute function public.generate_occurrence_protocol();

drop trigger if exists set_occurrences_updated_at on public.occurrences;
create trigger set_occurrences_updated_at
  before update on public.occurrences
  for each row
  execute function public.handle_updated_at();

-- 4. Tabela de atualizações cronológicas (Histórico / Timeline)
create table if not exists public.occurrence_updates (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment text,
  created_at timestamptz not null default now()
);

comment on table public.occurrence_updates is 'Atualizações cronológicas (comentários e anexos) de uma ocorrência.';

create index if not exists idx_occurrence_updates_occurrence_created
  on public.occurrence_updates (occurrence_id, created_at asc);

-- Atualiza updated_at da ocorrência pai sempre que uma atualização for adicionada
create or replace function public.touch_occurrence_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.occurrences
  set updated_at = now()
  where id = new.occurrence_id;
  return new;
end;
$$;

drop trigger if exists on_occurrence_update_inserted on public.occurrence_updates;
create trigger on_occurrence_update_inserted
  after insert on public.occurrence_updates
  for each row
  execute function public.touch_occurrence_on_update();

-- 5. Tabela de fotos (ligadas à abertura inicial ou a uma atualização da timeline)
create table if not exists public.occurrence_photos (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  update_id uuid references public.occurrence_updates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.occurrence_photos is 'Fotos anexadas na abertura (update_id null) ou nas atualizações da ocorrência.';

create index if not exists idx_occurrence_photos_occurrence
  on public.occurrence_photos (occurrence_id, created_at asc);

-- 6. Grants para usuários autenticados
grant select, insert, update on public.occurrences to authenticated;
grant select, insert on public.occurrence_updates to authenticated;
grant select, insert on public.occurrence_photos to authenticated;

-- 7. Row Level Security (RLS)
alter table public.occurrences enable row level security;
alter table public.occurrence_updates enable row level security;
alter table public.occurrence_photos enable row level security;

-- Ocorrências: leitura própria ou síndico
drop policy if exists "Ocorrências: leitura própria ou síndico" on public.occurrences;
create policy "Ocorrências: leitura própria ou síndico"
  on public.occurrences
  for select
  using (auth.uid() = user_id or public.is_sindico());

-- Ocorrências: criação pelo próprio morador com status inicial 'aberto'
drop policy if exists "Ocorrências: criação própria" on public.occurrences;
create policy "Ocorrências: criação própria"
  on public.occurrences
  for insert
  with check (
    auth.uid() = user_id
    and status = 'aberto'
  );

-- Ocorrências: alteração de status reservada ao síndico
drop policy if exists "Ocorrências: atualização pelo síndico" on public.occurrences;
create policy "Ocorrências: atualização pelo síndico"
  on public.occurrences
  for update
  using (public.is_sindico())
  with check (public.is_sindico());

-- Atualizações (Timeline): leitura pelo dono da ocorrência ou síndico
drop policy if exists "Atualizações: leitura própria ou síndico" on public.occurrence_updates;
create policy "Atualizações: leitura própria ou síndico"
  on public.occurrence_updates
  for select
  using (
    exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_updates.occurrence_id
        and (o.user_id = auth.uid() or public.is_sindico())
    )
  );

-- Atualizações (Timeline): inserção apenas enquanto a ocorrência estiver 'aberto'
drop policy if exists "Atualizações: inserção apenas se aberta" on public.occurrence_updates;
create policy "Atualizações: inserção apenas se aberta"
  on public.occurrence_updates
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_updates.occurrence_id
        and o.status = 'aberto'
        and (o.user_id = auth.uid() or public.is_sindico())
    )
  );

-- Fotos: leitura pelo dono da ocorrência ou síndico
drop policy if exists "Fotos: leitura própria ou síndico" on public.occurrence_photos;
create policy "Fotos: leitura própria ou síndico"
  on public.occurrence_photos
  for select
  using (
    exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_photos.occurrence_id
        and (o.user_id = auth.uid() or public.is_sindico())
    )
  );

-- Fotos: inserção apenas enquanto a ocorrência estiver 'aberto'
drop policy if exists "Fotos: inserção apenas se aberta" on public.occurrence_photos;
create policy "Fotos: inserção apenas se aberta"
  on public.occurrence_photos
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_photos.occurrence_id
        and o.status = 'aberto'
        and (o.user_id = auth.uid() or public.is_sindico())
    )
  );

-- 8. Storage: Bucket privado 'occurrences-media' + Políticas de acesso
insert into storage.buckets (id, name, public)
values ('occurrences-media', 'occurrences-media', false)
on conflict (id) do nothing;

-- Morador faz upload apenas na sua pasta (<user_id>/...)
drop policy if exists "Storage Vizo: upload na própria pasta" on storage.objects;
create policy "Storage Vizo: upload na própria pasta"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'occurrences-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Morador lê apenas as próprias fotos; síndico lê todas do bucket
drop policy if exists "Storage Vizo: leitura própria ou síndico" on storage.objects;
create policy "Storage Vizo: leitura própria ou síndico"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'occurrences-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_sindico()
    )
  );
