-- ============================================================================
-- Vizo — Etapa 3: Módulo do Síndico (Parecer de Encerramento e Permissões)
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele é idempotente (pode ser executado com segurança mais de uma vez).

-- 1. Coluna opcional para destacar no histórico qual atualização encerrou o chamado
alter table public.occurrence_updates
  add column if not exists status_change public.occurrence_status;

comment on column public.occurrence_updates.status_change is
  'Quando preenchido, indica que este parecer do síndico encerrou o chamado para o status informado.';

-- 2. Função atômica para o síndico encerrar uma ocorrência com parecer obrigatório
--    Garante que o parecer seja gravado na timeline e o status atualizado juntos.
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
  -- Apenas síndicos podem encerrar ocorrências
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

grant execute on function public.close_occurrence(uuid, public.occurrence_status, text)
  to authenticated;

-- 3. Atualiza política de leitura do Storage para que o morador também consiga
--    visualizar fotos de vistoria enviadas pelo síndico na sua própria ocorrência.
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
      or exists (
        select 1
        from public.occurrences o
        where o.id::text = (storage.foldername(name))[2]
          and o.user_id = auth.uid()
      )
    )
  );
