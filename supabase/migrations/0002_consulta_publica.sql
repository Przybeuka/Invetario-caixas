-- Consulta pública: qualquer pessoa vê caixas, materiais, conteúdo, fotos e situação.
-- Editar continua exigindo login aprovado. Nomes de pessoas e histórico seguem restritos.

-- Nome de quem conferiu: só aparece para usuários aprovados.
create or replace function public.conferido_por_nome(c public.conferencias)
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.nome from public.perfis p
  where p.id = c.conferido_por and public.pode_ler()
$$;
grant execute on function public.conferido_por_nome(public.conferencias) to anon, authenticated;
-- pode_ler() é chamada por essa função como dono; anon não precisa executá-la.

create or replace view public.v_caixas
with (security_invoker = true) as
select
  c.id, c.numero, c.nome, c.cor_id,
  co.nome as cor_nome, co.hex as cor_hex, co.ordem as cor_ordem, co.foto_modelo as cor_foto_modelo,
  c.tamanho, c.local, c.observacoes, c.foto_modelo, c.criado_em, c.atualizado_em,
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
  select count(*)::int as qtd_itens, sum(i.quantidade) as qtd_total,
         string_agg(m.nome, ' | ' order by m.nome) as materiais_busca
  from public.caixa_itens i join public.materiais m on m.id = i.material_id
  where i.caixa_id = c.id
) it on true
left join lateral (
  select cf.status, cf.conferido_em, public.conferido_por_nome(cf) as conferido_por_nome
  from public.conferencias cf
  where cf.caixa_id = c.id
  order by cf.conferido_em desc
  limit 1
) uc on true
left join lateral (
  select array_agg(f.caminho_miniatura order by f.ordem, f.criado_em) as miniaturas
  from public.fotos f where f.caixa_id = c.id
) fc on true
left join lateral (
  select array_agg(y.caminho_miniatura order by y.criado_em) as miniaturas
  from (
    select x.caminho_miniatura, x.criado_em
    from (
      select distinct on (i.material_id) f.caminho_miniatura, i.criado_em
      from public.caixa_itens i join public.fotos f on f.material_id = i.material_id
      where i.caixa_id = c.id
      order by i.material_id, f.ordem, f.criado_em
    ) x
    order by x.criado_em
    limit 6
  ) y
) fm on true;

-- Leitura aberta (anon e logados, inclusive pendentes).
grant select on public.cores, public.configuracoes, public.caixas, public.materiais, public.caixa_itens,
  public.fotos, public.conferencias, public.conferencia_itens, public.v_caixas, public.v_materiais to anon;

drop policy cores_ler on public.cores;
drop policy config_ler on public.configuracoes;
drop policy caixas_ler on public.caixas;
drop policy materiais_ler on public.materiais;
drop policy itens_ler on public.caixa_itens;
drop policy fotos_ler on public.fotos;
drop policy conf_ler on public.conferencias;
drop policy conf_itens_ler on public.conferencia_itens;

create policy cores_ler on public.cores for select to anon, authenticated using (true);
create policy config_ler on public.configuracoes for select to anon, authenticated using (true);
create policy caixas_ler on public.caixas for select to anon, authenticated using (true);
create policy materiais_ler on public.materiais for select to anon, authenticated using (true);
create policy itens_ler on public.caixa_itens for select to anon, authenticated using (true);
create policy fotos_ler on public.fotos for select to anon, authenticated using (true);
create policy conf_ler on public.conferencias for select to anon, authenticated using (true);
create policy conf_itens_ler on public.conferencia_itens for select to anon, authenticated using (true);
