-- ============================================================================
-- Vizo — Etapa 5: Blindagem Multi-Tenant, Escopo/Categoria/Urgência e Gestão
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele é idempotente (pode ser executado com segurança mais de uma vez).

-- 1. Novos campos nas ocorrências (Escopo, Categoria e Urgência)
alter table public.occurrences
  add column if not exists scope text not null default 'unidade';

alter table public.occurrences
  add column if not exists category text not null default 'Outro';

alter table public.occurrences
  add column if not exists priority text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'occurrence_scope_check'
  ) then
    alter table public.occurrences
      add constraint occurrence_scope_check
      check (scope in ('unidade', 'area_comum'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'occurrence_priority_check'
  ) then
    alter table public.occurrences
      add constraint occurrence_priority_check
      check (priority in ('normal', 'alta', 'emergencia'));
  end if;
end $$;

create index if not exists idx_occurrences_priority
  on public.occurrences (priority);

-- 2. Blindagem Multi-Tenant: helper unificado para verificar se o síndico gere a ocorrência
create or replace function public.can_sindico_manage_occurrence(p_condo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_condo_id is not null and public.manages_condominium(p_condo_id))
    or (p_condo_id is null and public.is_sindico());
$$;

-- 3. Blindagem na tabela profiles: impede morador de alterar role OU condominium_id
drop policy if exists "Perfis: atualização própria sem alterar role" on public.profiles;
create policy "Perfis: atualização própria sem alterar role"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and condominium_id is not distinct from (
      select p.condominium_id from public.profiles p where p.id = auth.uid()
    )
  );

-- 4. Blindagem na criação de ocorrências (morador cria no próprio condomínio; síndico cria nos condomínios que gere)
drop policy if exists "Ocorrências: criação própria" on public.occurrences;
create policy "Ocorrências: criação própria"
  on public.occurrences
  for insert
  with check (
    auth.uid() = user_id
    and status = 'aberto'
    and (
      condominium_id is null
      or condominium_id = public.current_user_condominium_id()
      or public.manages_condominium(condominium_id)
    )
  );

-- 5. Blindagem nas atualizações da timeline (occurrence_updates)
drop policy if exists "Atualizações: leitura própria ou síndico" on public.occurrence_updates;
create policy "Atualizações: leitura própria ou síndico"
  on public.occurrence_updates
  for select
  using (
    exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_updates.occurrence_id
        and (
          o.user_id = auth.uid()
          or public.can_sindico_manage_occurrence(o.condominium_id)
        )
    )
  );

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
        and (
          o.user_id = auth.uid()
          or public.can_sindico_manage_occurrence(o.condominium_id)
        )
    )
  );

-- 6. Blindagem nas fotos (occurrence_photos)
drop policy if exists "Fotos: leitura própria ou síndico" on public.occurrence_photos;
create policy "Fotos: leitura própria ou síndico"
  on public.occurrence_photos
  for select
  using (
    exists (
      select 1
      from public.occurrences o
      where o.id = occurrence_photos.occurrence_id
        and (
          o.user_id = auth.uid()
          or public.can_sindico_manage_occurrence(o.condominium_id)
        )
    )
  );

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
        and (
          o.user_id = auth.uid()
          or public.can_sindico_manage_occurrence(o.condominium_id)
        )
    )
  );

-- 7. Blindagem na função atômica close_occurrence (verifica se o síndico gere o condomínio)
create or replace function public.close_occurrence(
  p_occurrence_id uuid,
  p_new_status public.occurrence_status,
  p_comment text
)
returns public.occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ public.occurrences;
begin
  if not public.is_sindico() then
    raise exception 'Apenas usuários com perfil de síndico podem encerrar ocorrências.';
  end if;

  if p_new_status not in ('resolvido', 'cancelado') then
    raise exception 'Status de encerramento inválido. Use resolvido ou cancelado.';
  end if;

  if p_comment is null or char_length(btrim(p_comment)) < 10 then
    raise exception 'Informe um parecer de encerramento com pelo menos 10 caracteres.';
  end if;

  select *
    into v_occ
    from public.occurrences
   where id = p_occurrence_id
   for update;

  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;

  if v_occ.condominium_id is not null and not public.manages_condominium(v_occ.condominium_id) then
    raise exception 'Você não tem permissão para encerrar ocorrências de outro condomínio.';
  end if;

  if v_occ.status <> 'aberto' then
    raise exception 'Esta ocorrência já está encerrada (%).', v_occ.status;
  end if;

  insert into public.occurrence_updates (
    occurrence_id,
    user_id,
    comment,
    status_change
  )
  values (
    p_occurrence_id,
    auth.uid(),
    btrim(p_comment),
    p_new_status
  );

  update public.occurrences
     set status = p_new_status,
         updated_at = now()
   where id = p_occurrence_id
   returning * into v_occ;

  return v_occ;
end;
$$;

-- 8. Blindagem no Storage (occurrences-media): síndico lê apenas fotos dos próprios condomínios
drop policy if exists "Storage Vizo: leitura própria ou síndico" on storage.objects;
create policy "Storage Vizo: leitura própria ou síndico"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'occurrences-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.occurrences o
        where o.id::text = (storage.foldername(name))[2]
          and (
            o.user_id = auth.uid()
            or public.can_sindico_manage_occurrence(o.condominium_id)
          )
      )
    )
  );

-- 9. RPCs de gestão de moradores pelo síndico (editar unidade e desvincular morador que se mudou)
create or replace function public.sindico_update_resident_unit(
  p_resident_id uuid,
  p_block text,
  p_unit text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.profiles;
  v_clean_block text;
  v_clean_unit text;
begin
  if not public.is_sindico() then
    raise exception 'Apenas síndicos podem editar unidades de moradores.';
  end if;

  v_clean_block := btrim(coalesce(p_block, ''));
  v_clean_unit := btrim(coalesce(p_unit, ''));

  if char_length(v_clean_block) < 1 or char_length(v_clean_unit) < 1 then
    raise exception 'Informe o bloco/torre e o número do apartamento/casa.';
  end if;

  select *
    into v_resident
    from public.profiles
   where id = p_resident_id
     and role = 'morador'
   for update;

  if not found then
    raise exception 'Morador não encontrado.';
  end if;

  if v_resident.condominium_id is null or not public.manages_condominium(v_resident.condominium_id) then
    raise exception 'Você não tem permissão para editar este morador.';
  end if;

  update public.profiles
     set block = v_clean_block,
         unit = v_clean_unit,
         updated_at = now()
   where id = p_resident_id
   returning * into v_resident;

  return v_resident;
end;
$$;

grant execute on function public.sindico_update_resident_unit(uuid, text, text)
  to authenticated;

create or replace function public.sindico_remove_resident(
  p_resident_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.profiles;
begin
  if not public.is_sindico() then
    raise exception 'Apenas síndicos podem desvincular moradores.';
  end if;

  select *
    into v_resident
    from public.profiles
   where id = p_resident_id
     and role = 'morador'
   for update;

  if not found then
    raise exception 'Morador não encontrado.';
  end if;

  if v_resident.condominium_id is null or not public.manages_condominium(v_resident.condominium_id) then
    raise exception 'Você não tem permissão para desvincular este morador.';
  end if;

  update public.profiles
     set condominium_id = null,
         onboarding_completed = false,
         updated_at = now()
   where id = p_resident_id;

  return true;
end;
$$;

grant execute on function public.sindico_remove_resident(uuid)
  to authenticated;
