-- =====================================================================
-- Inventário de Caixas — esquema inicial
-- Acesso: tudo exige login aprovado.
--   pendente   → sem acesso (aguardando aprovação)
--   conferente → consulta e registra conferências
--   editor     → + cadastra/edita caixas, materiais e fotos
--   admin      → + exclui caixas/materiais, gerencia usuários e cores
-- =====================================================================

create type public.papel as enum ('pendente', 'conferente', 'editor', 'admin');

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text,
  papel public.papel not null default 'pendente',
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções de permissão (security definer evita recursão no RLS de perfis)
-- ---------------------------------------------------------------------
create or replace function public.meu_papel()
returns public.papel
language sql stable security definer
set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = auth.uid()
$$;

create or replace function public.pode_ler()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.papel in ('conferente', 'editor', 'admin') from public.perfis p where p.id = auth.uid()),
    false)
$$;

create or replace function public.pode_editar()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.papel in ('editor', 'admin') from public.perfis p where p.id = auth.uid()),
    false)
$$;

create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.papel = 'admin' from public.perfis p where p.id = auth.uid()),
    false)
$$;

-- Primeiro usuário vira admin; os demais entram como conferentes (ver 0004).
create or replace function public.criar_perfil()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    case when exists (select 1 from public.perfis where papel = 'admin')
      then 'pendente'::public.papel
      else 'admin'::public.papel
    end
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Só admin muda papel; nunca deixa o sistema sem admin.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.criado_em := old.criado_em;
  if new.papel is distinct from old.papel then
    if auth.uid() is not null and not public.eh_admin() then
      raise exception 'Apenas administradores podem alterar o nível de acesso.';
    end if;
    if old.papel = 'admin' and new.papel <> 'admin'
       and (select count(*) from public.perfis where papel = 'admin') <= 1 then
      raise exception 'O sistema precisa de pelo menos um administrador.';
    end if;
  end if;
  return new;
end;
$$;

create trigger perfis_proteger
  before update on public.perfis
  for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------------
-- Configurações (linha única)
-- ---------------------------------------------------------------------
create table public.configuracoes (
  id smallint primary key default 1 check (id = 1),
  validade_conferencia_dias int not null default 30 check (validade_conferencia_dias >= 0),
  atualizado_em timestamptz not null default now()
);
insert into public.configuracoes (id) values (1);

-- ---------------------------------------------------------------------
-- Cores das caixas (acesso rápido na home)
-- ---------------------------------------------------------------------
create table public.cores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  foto_modelo text,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

insert into public.cores (nome, hex, foto_modelo, ordem) values
  ('Caqui',    '#B5A27E', 'caqui-1',    1),
  ('Azul',     '#1D5FD1', 'azul-1',     2),
  ('Vermelha', '#E3262E', 'vermelha-1', 3),
  ('Amarela',  '#F2CF1D', 'amarela-1',  4),
  ('Preta',    '#232323', 'preta-1',    5);

-- ---------------------------------------------------------------------
-- Caixas
-- ---------------------------------------------------------------------
create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero > 0),
  nome text not null check (length(trim(nome)) > 0),
  cor_id uuid references public.cores (id) on delete set null,
  tamanho text check (tamanho in ('pequena', 'media', 'grande')),
  local text,
  observacoes text,
  foto_modelo text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.perfis (id) on delete set null
);
create index caixas_nome_idx on public.caixas (lower(nome));
create index caixas_cor_idx on public.caixas (cor_id);

-- ---------------------------------------------------------------------
-- Materiais (catálogo)
-- ---------------------------------------------------------------------
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  categoria text,
  unidade text not null default 'un',
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references public.perfis (id) on delete set null
);
create unique index materiais_nome_unico on public.materiais (lower(nome));

-- ---------------------------------------------------------------------
-- Conteúdo das caixas
-- ---------------------------------------------------------------------
create table public.caixa_itens (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas (id) on delete cascade,
  material_id uuid not null references public.materiais (id) on delete cascade,
  quantidade numeric(10, 2) not null default 1 check (quantidade > 0),
  observacao text,
  criado_em timestamptz not null default now(),
  unique (caixa_id, material_id)
);
create index caixa_itens_material_idx on public.caixa_itens (material_id);

-- ---------------------------------------------------------------------
-- Fotos (de caixa ou de material)
-- ---------------------------------------------------------------------
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid references public.caixas (id) on delete cascade,
  material_id uuid references public.materiais (id) on delete cascade,
  caminho text not null,
  caminho_miniatura text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  constraint fotos_um_dono check (num_nonnulls(caixa_id, material_id) = 1)
);
create index fotos_caixa_idx on public.fotos (caixa_id);
create index fotos_material_idx on public.fotos (material_id);

-- ---------------------------------------------------------------------
-- Conferências
-- ---------------------------------------------------------------------
create table public.conferencias (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas (id) on delete cascade,
  status text not null check (status in ('ok', 'pendencia')),
  observacao text,
  conferido_por uuid default auth.uid() references public.perfis (id) on delete set null,
  conferido_em timestamptz not null default now()
);
create index conferencias_caixa_idx on public.conferencias (caixa_id, conferido_em desc);
create index conferencias_por_idx on public.conferencias (conferido_por);

create table public.conferencia_itens (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias (id) on delete cascade,
  material_id uuid references public.materiais (id) on delete set null,
  material_nome text not null,
  quantidade_esperada numeric(10, 2) not null,
  quantidade_encontrada numeric(10, 2) not null check (quantidade_encontrada >= 0),
  observacao text
);
create index conferencia_itens_conf_idx on public.conferencia_itens (conferencia_id);
create index conferencia_itens_material_idx on public.conferencia_itens (material_id);

-- ---------------------------------------------------------------------
-- Histórico (auditoria)
-- ---------------------------------------------------------------------
create table public.historico (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null check (acao in ('criou', 'alterou', 'excluiu')),
  resumo text,
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  criado_em timestamptz not null default now()
);
create index historico_criado_idx on public.historico (criado_em desc);
create index historico_registro_idx on public.historico (registro_id);

-- ---------------------------------------------------------------------
-- Gatilhos utilitários
-- ---------------------------------------------------------------------
create or replace function public.normalizar_nome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  return new;
end;
$$;

create or replace function public.tocar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), old.atualizado_por);
  return new;
end;
$$;

create or replace function public.registrar_historico()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reg jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_acao text;
  v_resumo text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criou';
    v_reg := to_jsonb(new);
    v_depois := v_reg;
  elsif tg_op = 'UPDATE' then
    v_acao := 'alterou';
    v_reg := to_jsonb(new);
    v_antes := to_jsonb(old);
    v_depois := v_reg;
    if (v_antes - 'atualizado_em' - 'atualizado_por') = (v_depois - 'atualizado_em' - 'atualizado_por') then
      return new;
    end if;
  else
    v_acao := 'excluiu';
    v_reg := to_jsonb(old);
    v_antes := v_reg;
  end if;

  if tg_table_name = 'caixas' then
    v_resumo := format('Caixa %s · %s', v_reg ->> 'numero', v_reg ->> 'nome');
    if tg_op = 'DELETE' then
      v_antes := v_antes || jsonb_build_object('itens', coalesce((
        select jsonb_agg(jsonb_build_object('material', m.nome, 'quantidade', i.quantidade) order by m.nome)
        from public.caixa_itens i
        join public.materiais m on m.id = i.material_id
        where i.caixa_id = old.id), '[]'::jsonb));
    end if;

  elsif tg_table_name = 'materiais' then
    v_resumo := format('Material %s', v_reg ->> 'nome');
    if tg_op = 'DELETE' then
      v_antes := v_antes || jsonb_build_object('caixas', coalesce((
        select jsonb_agg(jsonb_build_object('numero', c.numero, 'nome', c.nome, 'quantidade', i.quantidade) order by c.numero)
        from public.caixa_itens i
        join public.caixas c on c.id = i.caixa_id
        where i.material_id = old.id), '[]'::jsonb));
    end if;

  elsif tg_table_name = 'caixa_itens' then
    select format('%s × %s · caixa %s (%s)',
                  trim_scale((v_reg ->> 'quantidade')::numeric), m.nome, c.numero, c.nome)
      into v_resumo
      from public.materiais m
      cross join public.caixas c
      where m.id = (v_reg ->> 'material_id')::uuid
        and c.id = (v_reg ->> 'caixa_id')::uuid;
    if v_resumo is null then
      return null; -- caixa ou material excluído junto: o registro do pai já guarda tudo
    end if;

  elsif tg_table_name = 'fotos' then
    if v_reg ->> 'caixa_id' is not null then
      select format('Foto · caixa %s (%s)', c.numero, c.nome) into v_resumo
        from public.caixas c where c.id = (v_reg ->> 'caixa_id')::uuid;
    else
      select format('Foto · material %s', m.nome) into v_resumo
        from public.materiais m where m.id = (v_reg ->> 'material_id')::uuid;
    end if;
    if v_resumo is null then
      return null;
    end if;

  elsif tg_table_name = 'conferencias' then
    select format('Conferência · caixa %s (%s) · %s', c.numero, c.nome,
                  case v_reg ->> 'status' when 'ok' then 'OK' else 'com pendência' end)
      into v_resumo
      from public.caixas c where c.id = (v_reg ->> 'caixa_id')::uuid;
    if v_resumo is null then
      return null;
    end if;
  end if;

  insert into public.historico (tabela, registro_id, acao, resumo, antes, depois, usuario_id, usuario_nome)
  values (
    tg_table_name,
    (v_reg ->> 'id')::uuid,
    v_acao,
    v_resumo,
    v_antes,
    v_depois,
    auth.uid(),
    (select p.nome from public.perfis p where p.id = auth.uid())
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger caixas_normalizar before insert or update of nome on public.caixas
  for each row execute function public.normalizar_nome();
create trigger materiais_normalizar before insert or update of nome on public.materiais
  for each row execute function public.normalizar_nome();
create trigger caixas_tocar before update on public.caixas
  for each row execute function public.tocar_atualizacao();
create trigger materiais_tocar before update on public.materiais
  for each row execute function public.tocar_atualizacao();

create trigger caixas_hist after insert or update on public.caixas
  for each row execute function public.registrar_historico();
create trigger caixas_hist_excluir before delete on public.caixas
  for each row execute function public.registrar_historico();
create trigger materiais_hist after insert or update on public.materiais
  for each row execute function public.registrar_historico();
create trigger materiais_hist_excluir before delete on public.materiais
  for each row execute function public.registrar_historico();
create trigger caixa_itens_hist after insert or update or delete on public.caixa_itens
  for each row execute function public.registrar_historico();
create trigger fotos_hist after insert or delete on public.fotos
  for each row execute function public.registrar_historico();
create trigger conferencias_hist after insert or delete on public.conferencias
  for each row execute function public.registrar_historico();

-- ---------------------------------------------------------------------
-- Visões para a interface
-- ---------------------------------------------------------------------
create or replace view public.v_caixas
with (security_invoker = true) as
select
  c.id,
  c.numero,
  c.nome,
  c.cor_id,
  co.nome as cor_nome,
  co.hex as cor_hex,
  co.ordem as cor_ordem,
  co.foto_modelo as cor_foto_modelo,
  c.tamanho,
  c.local,
  c.observacoes,
  c.foto_modelo,
  c.criado_em,
  c.atualizado_em,
  coalesce(it.qtd_itens, 0) as qtd_itens,
  coalesce(it.qtd_total, 0) as qtd_total,
  it.materiais_busca,
  uc.status as conferencia_status,
  uc.conferido_em,
  uc.conferido_por_nome,
  fc.miniaturas as fotos_caixa,
  fm.miniaturas as fotos_materiais
from public.caixas c
left join public.cores co on co.id = c.cor_id
left join lateral (
  select
    count(*)::int as qtd_itens,
    sum(i.quantidade) as qtd_total,
    string_agg(m.nome, ' | ' order by m.nome) as materiais_busca
  from public.caixa_itens i
  join public.materiais m on m.id = i.material_id
  where i.caixa_id = c.id
) it on true
left join lateral (
  select cf.status, cf.conferido_em, p.nome as conferido_por_nome
  from public.conferencias cf
  left join public.perfis p on p.id = cf.conferido_por
  where cf.caixa_id = c.id
  order by cf.conferido_em desc
  limit 1
) uc on true
left join lateral (
  select array_agg(f.caminho_miniatura order by f.ordem, f.criado_em) as miniaturas
  from public.fotos f
  where f.caixa_id = c.id
) fc on true
left join lateral (
  select array_agg(y.caminho_miniatura order by y.criado_em) as miniaturas
  from (
    select x.caminho_miniatura, x.criado_em
    from (
      select distinct on (i.material_id) f.caminho_miniatura, i.criado_em
      from public.caixa_itens i
      join public.fotos f on f.material_id = i.material_id
      where i.caixa_id = c.id
      order by i.material_id, f.ordem, f.criado_em
    ) x
    order by x.criado_em
    limit 6
  ) y
) fm on true;

create or replace view public.v_materiais
with (security_invoker = true) as
select
  m.id,
  m.nome,
  m.descricao,
  m.categoria,
  m.unidade,
  m.criado_em,
  m.atualizado_em,
  coalesce(u.qtd_caixas, 0) as qtd_caixas,
  coalesce(u.qtd_total, 0) as qtd_total,
  f.miniaturas as fotos
from public.materiais m
left join lateral (
  select count(*)::int as qtd_caixas, sum(i.quantidade) as qtd_total
  from public.caixa_itens i
  where i.material_id = m.id
) u on true
left join lateral (
  select array_agg(fo.caminho_miniatura order by fo.ordem, fo.criado_em) as miniaturas
  from public.fotos fo
  where fo.material_id = m.id
) f on true;

-- ---------------------------------------------------------------------
-- Funções chamadas pelo app
-- ---------------------------------------------------------------------
create or replace function public.registrar_conferencia(
  p_caixa_id uuid,
  p_itens jsonb,
  p_observacao text default null,
  p_pendencia boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_falta boolean;
begin
  if not public.pode_ler() then
    raise exception 'Sem permissão para conferir caixas.';
  end if;

  select coalesce(bool_or(x.quantidade_encontrada < x.quantidade_esperada), false)
    into v_falta
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    material_id uuid, material_nome text, quantidade_esperada numeric,
    quantidade_encontrada numeric, observacao text);

  insert into public.conferencias (caixa_id, status, observacao)
  values (
    p_caixa_id,
    case when v_falta or coalesce(p_pendencia, false) then 'pendencia' else 'ok' end,
    nullif(trim(p_observacao), '')
  )
  returning id into v_id;

  insert into public.conferencia_itens
    (conferencia_id, material_id, material_nome, quantidade_esperada, quantidade_encontrada, observacao)
  select v_id, x.material_id, x.material_nome, x.quantidade_esperada, x.quantidade_encontrada,
         nullif(trim(x.observacao), '')
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    material_id uuid, material_nome text, quantidade_esperada numeric,
    quantidade_encontrada numeric, observacao text);

  return v_id;
end;
$$;

-- Copia o conteúdo de uma caixa para outras (substituindo ou somando).
create or replace function public.copiar_conteudo(
  p_origem uuid,
  p_destinos uuid[],
  p_substituir boolean default true
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_qtd int;
begin
  if not public.pode_editar() then
    raise exception 'Sem permissão para editar caixas.';
  end if;

  if p_substituir then
    delete from public.caixa_itens
    where caixa_id = any (p_destinos) and caixa_id <> p_origem;
  end if;

  insert into public.caixa_itens (caixa_id, material_id, quantidade, observacao)
  select d.id, i.material_id, i.quantidade, i.observacao
  from unnest(p_destinos) as d (id)
  cross join public.caixa_itens i
  where i.caixa_id = p_origem and d.id <> p_origem
  on conflict (caixa_id, material_id)
  do update set quantidade = excluded.quantidade, observacao = excluded.observacao;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- Chamado 1x por dia pela Vercel para o projeto grátis não pausar.
create or replace function public.ping()
returns timestamptz
language sql stable
set search_path = ''
as $$
  select now()
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.meu_papel(), public.pode_ler(), public.pode_editar(), public.eh_admin()
  to authenticated;
grant execute on function public.registrar_conferencia(uuid, jsonb, text, boolean),
  public.copiar_conteudo(uuid, uuid[], boolean) to authenticated;
revoke execute on function public.criar_perfil(), public.proteger_perfil(), public.registrar_historico(),
  public.normalizar_nome(), public.tocar_atualizacao() from authenticated;
grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.configuracoes enable row level security;
alter table public.cores enable row level security;
alter table public.caixas enable row level security;
alter table public.materiais enable row level security;
alter table public.caixa_itens enable row level security;
alter table public.fotos enable row level security;
alter table public.conferencias enable row level security;
alter table public.conferencia_itens enable row level security;
alter table public.historico enable row level security;

-- perfis
create policy perfis_ler on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.pode_ler()));
create policy perfis_editar on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin()))
  with check (id = (select auth.uid()) or (select public.eh_admin()));

-- configurações
create policy config_ler on public.configuracoes for select to authenticated
  using ((select public.pode_ler()));
create policy config_editar on public.configuracoes for update to authenticated
  using ((select public.eh_admin())) with check ((select public.eh_admin()));

-- cores
create policy cores_ler on public.cores for select to authenticated
  using ((select public.pode_ler()));
create policy cores_criar on public.cores for insert to authenticated
  with check ((select public.eh_admin()));
create policy cores_editar on public.cores for update to authenticated
  using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy cores_excluir on public.cores for delete to authenticated
  using ((select public.eh_admin()));

-- caixas
create policy caixas_ler on public.caixas for select to authenticated
  using ((select public.pode_ler()));
create policy caixas_criar on public.caixas for insert to authenticated
  with check ((select public.pode_editar()));
create policy caixas_editar on public.caixas for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy caixas_excluir on public.caixas for delete to authenticated
  using ((select public.eh_admin()));

-- materiais
create policy materiais_ler on public.materiais for select to authenticated
  using ((select public.pode_ler()));
create policy materiais_criar on public.materiais for insert to authenticated
  with check ((select public.pode_editar()));
create policy materiais_editar on public.materiais for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy materiais_excluir on public.materiais for delete to authenticated
  using ((select public.eh_admin()));

-- conteúdo das caixas
create policy itens_ler on public.caixa_itens for select to authenticated
  using ((select public.pode_ler()));
create policy itens_criar on public.caixa_itens for insert to authenticated
  with check ((select public.pode_editar()));
create policy itens_editar on public.caixa_itens for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy itens_excluir on public.caixa_itens for delete to authenticated
  using ((select public.pode_editar()));

-- fotos
create policy fotos_ler on public.fotos for select to authenticated
  using ((select public.pode_ler()));
create policy fotos_criar on public.fotos for insert to authenticated
  with check ((select public.pode_editar()));
create policy fotos_editar on public.fotos for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy fotos_excluir on public.fotos for delete to authenticated
  using ((select public.pode_editar()));

-- conferências (conferente pode registrar)
create policy conf_ler on public.conferencias for select to authenticated
  using ((select public.pode_ler()));
create policy conf_criar on public.conferencias for insert to authenticated
  with check ((select public.pode_ler()) and conferido_por = (select auth.uid()));
create policy conf_excluir on public.conferencias for delete to authenticated
  using ((select public.eh_admin()));

create policy conf_itens_ler on public.conferencia_itens for select to authenticated
  using ((select public.pode_ler()));
create policy conf_itens_criar on public.conferencia_itens for insert to authenticated
  with check ((select public.pode_ler()));

-- histórico (só leitura, para editores e admins)
create policy historico_ler on public.historico for select to authenticated
  using ((select public.pode_editar()));

-- ---------------------------------------------------------------------
-- Storage: bucket de fotos
-- (leitura por link público; envio/remoção só para editores)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fotos_storage_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (select public.pode_ler()));
create policy fotos_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (select public.pode_editar()));
create policy fotos_storage_atualizar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (select public.pode_editar()));
create policy fotos_storage_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (select public.pode_editar()));
