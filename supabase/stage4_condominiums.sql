-- ============================================================================
-- Vizo — Etapa 4: Multi-Condomínios, Convites de Moradores e Lista Agrupada
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele é idempotente (pode ser executado com segurança mais de uma vez).

-- 1. Tabela de Condomínios (um síndico pode criar e gerir vários condomínios)
create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  sindico_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  cnpj text unique not null,
  address text not null,
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint condominium_name_min check (char_length(btrim(name)) >= 3),
  constraint condominium_cnpj_digits check (cnpj ~ '^[0-9]{14}$'),
  constraint condominium_address_min check (char_length(btrim(address)) >= 5),
  constraint condominium_email_format check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.condominiums is 'Condomínios residenciais geridos pelos síndicos no Vizo.';

create index if not exists idx_condominiums_sindico
  on public.condominiums (sindico_id, created_at desc);

drop trigger if exists set_condominiums_updated_at on public.condominiums;
create trigger set_condominiums_updated_at
  before update on public.condominiums
  for each row
  execute function public.handle_updated_at();

-- 2. Vincular perfis e ocorrências ao condomínio
alter table public.profiles
  add column if not exists condominium_id uuid references public.condominiums (id) on delete set null;

alter table public.occurrences
  add column if not exists condominium_id uuid references public.condominiums (id) on delete set null;

create index if not exists idx_profiles_condominium_unit
  on public.profiles (condominium_id, block, unit);

create index if not exists idx_occurrences_condominium_created
  on public.occurrences (condominium_id, created_at desc);

-- Preenche automaticamente condominium_id na ocorrência com base no perfil do morador
create or replace function public.sync_occurrence_condominium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.condominium_id is null then
    select p.condominium_id
      into new.condominium_id
      from public.profiles p
     where p.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_occurrence_condominium on public.occurrences;
create trigger set_occurrence_condominium
  before insert on public.occurrences
  for each row
  execute function public.sync_occurrence_condominium();

-- 3. Tabela de Convites para cadastro de moradores no condomínio
create table if not exists public.condominium_invites (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  token text unique not null,
  prefilled_block text,
  prefilled_unit text,
  target_email text,
  max_uses int not null default 1,
  uses_count int not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint invite_max_uses_range check (max_uses >= 1 and max_uses <= 100),
  constraint invite_uses_count_valid check (uses_count >= 0 and uses_count <= max_uses)
);

comment on table public.condominium_invites is 'Links de convite gerados pelo síndico para cadastro de moradores.';

create index if not exists idx_invites_condominium_created
  on public.condominium_invites (condominium_id, created_at desc);

create index if not exists idx_invites_token
  on public.condominium_invites (token);

-- 4. Helpers de autorização multi-condomínio
create or replace function public.manages_condominium(p_condo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.condominiums c
    where c.id = p_condo_id
      and c.sindico_id = auth.uid()
  );
$$;

create or replace function public.current_user_condominium_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.condominium_id
  from public.profiles p
  where p.id = auth.uid();
$$;

-- 5. RPC pública (anon + authenticated) para pré-visualizar e validar um link de convite
create or replace function public.get_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_clean_token text;
begin
  v_clean_token := btrim(coalesce(p_token, ''));
  if v_clean_token = '' then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  select
    i.token,
    i.condominium_id,
    i.prefilled_block,
    i.prefilled_unit,
    i.target_email,
    i.max_uses,
    i.uses_count,
    i.expires_at,
    i.revoked_at,
    c.name as condominium_name,
    c.address as condominium_address
  into v_invite
  from public.condominium_invites i
  join public.condominiums c on c.id = i.condominium_id
  where i.token = v_clean_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_invite.revoked_at is not null then
    return jsonb_build_object(
      'valid', false,
      'reason', 'revoked',
      'condominium_name', v_invite.condominium_name
    );
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'condominium_name', v_invite.condominium_name
    );
  end if;

  if v_invite.uses_count >= v_invite.max_uses then
    return jsonb_build_object(
      'valid', false,
      'reason', 'exhausted',
      'condominium_name', v_invite.condominium_name
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'reason', null,
    'token', v_invite.token,
    'condominium_id', v_invite.condominium_id,
    'condominium_name', v_invite.condominium_name,
    'condominium_address', v_invite.condominium_address,
    'prefilled_block', v_invite.prefilled_block,
    'prefilled_unit', v_invite.prefilled_unit,
    'target_email', v_invite.target_email,
    'expires_at', v_invite.expires_at,
    'remaining_uses', greatest(0, v_invite.max_uses - v_invite.uses_count)
  );
end;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- 6. RPC atômica para resgatar convite e concluir onboarding do morador
create or replace function public.redeem_invite_and_complete_onboarding(
  p_token text,
  p_full_name text,
  p_cpf text,
  p_phone text,
  p_block text,
  p_unit text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_invite public.condominium_invites;
  v_profile public.profiles;
  v_clean_token text;
  v_clean_cpf text;
  v_clean_phone text;
  v_final_block text;
  v_final_unit text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  v_clean_token := btrim(coalesce(p_token, ''));
  if v_clean_token = '' then
    raise exception 'Convite obrigatório para concluir o cadastro de morador.';
  end if;

  select *
    into v_invite
    from public.condominium_invites
   where token = v_clean_token
   for update;

  if not found then
    raise exception 'Link de convite não encontrado ou inválido.';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Este convite foi revogado pelo síndico.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Este convite expirou. Solicite um novo link ao síndico.';
  end if;

  if v_invite.uses_count >= v_invite.max_uses then
    raise exception 'Este convite já atingiu o limite máximo de cadastros.';
  end if;

  v_clean_cpf := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_clean_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if char_length(v_clean_cpf) <> 11 then
    raise exception 'CPF inválido. Informe 11 dígitos.';
  end if;

  if char_length(v_clean_phone) not in (10, 11) then
    raise exception 'Telefone/WhatsApp inválido.';
  end if;

  v_final_block := coalesce(nullif(btrim(v_invite.prefilled_block), ''), btrim(coalesce(p_block, '')));
  v_final_unit := coalesce(nullif(btrim(v_invite.prefilled_unit), ''), btrim(coalesce(p_unit, '')));

  if char_length(v_final_block) < 1 or char_length(v_final_unit) < 1 then
    raise exception 'Informe o bloco/torre e o número do apartamento/casa.';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into public.profiles (
    id,
    email,
    full_name,
    cpf,
    phone,
    block,
    unit,
    role,
    condominium_id,
    onboarding_completed
  )
  values (
    v_uid,
    v_email,
    btrim(p_full_name),
    v_clean_cpf,
    v_clean_phone,
    v_final_block,
    v_final_unit,
    'morador',
    v_invite.condominium_id,
    true
  )
  on conflict (id) do update
     set full_name = excluded.full_name,
         cpf = excluded.cpf,
         phone = excluded.phone,
         block = excluded.block,
         unit = excluded.unit,
         condominium_id = excluded.condominium_id,
         onboarding_completed = true,
         updated_at = now()
  returning * into v_profile;

  update public.condominium_invites
     set uses_count = uses_count + 1
   where id = v_invite.id;

  return v_profile;
end;
$$;

grant execute on function public.redeem_invite_and_complete_onboarding(text, text, text, text, text, text)
  to authenticated;

-- 7. Permissões e RLS das novas tabelas
grant select, insert, update on public.condominiums to authenticated;
grant select, insert, update on public.condominium_invites to authenticated;

alter table public.condominiums enable row level security;
alter table public.condominium_invites enable row level security;

drop policy if exists "Condomínios: leitura pelo síndico ou morador vinculado" on public.condominiums;
create policy "Condomínios: leitura pelo síndico ou morador vinculado"
  on public.condominiums
  for select
  using (
    sindico_id = auth.uid()
    or id = public.current_user_condominium_id()
  );

drop policy if exists "Condomínios: criação pelo síndico" on public.condominiums;
create policy "Condomínios: criação pelo síndico"
  on public.condominiums
  for insert
  with check (
    sindico_id = auth.uid()
    and public.is_sindico()
  );

drop policy if exists "Condomínios: edição pelo síndico" on public.condominiums;
create policy "Condomínios: edição pelo síndico"
  on public.condominiums
  for update
  using (sindico_id = auth.uid() and public.is_sindico())
  with check (sindico_id = auth.uid() and public.is_sindico());

drop policy if exists "Convites: gestão pelo síndico do condomínio" on public.condominium_invites;
create policy "Convites: gestão pelo síndico do condomínio"
  on public.condominium_invites
  for all
  using (public.manages_condominium(condominium_id))
  with check (
    created_by = auth.uid()
    and public.manages_condominium(condominium_id)
  );

-- 8. Atualiza RLS de profiles e occurrences para isolamento multi-condomínio
--    (mantendo compatibilidade com registros antigos sem condominium_id)
drop policy if exists "Perfis: leitura própria ou síndico" on public.profiles;
create policy "Perfis: leitura própria ou síndico"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or (condominium_id is not null and public.manages_condominium(condominium_id))
    or (condominium_id is null and public.is_sindico())
  );

drop policy if exists "Ocorrências: leitura própria ou síndico" on public.occurrences;
create policy "Ocorrências: leitura própria ou síndico"
  on public.occurrences
  for select
  using (
    auth.uid() = user_id
    or (condominium_id is not null and public.manages_condominium(condominium_id))
    or (condominium_id is null and public.is_sindico())
  );

drop policy if exists "Ocorrências: atualização pelo síndico" on public.occurrences;
create policy "Ocorrências: atualização pelo síndico"
  on public.occurrences
  for update
  using (
    (condominium_id is not null and public.manages_condominium(condominium_id))
    or (condominium_id is null and public.is_sindico())
  )
  with check (
    (condominium_id is not null and public.manages_condominium(condominium_id))
    or (condominium_id is null and public.is_sindico())
  );
