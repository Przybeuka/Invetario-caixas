-- Peso e dimensões da caixa (usados na ficha de conferência e no adesivo).
alter table public.caixas
  add column peso_kg numeric(7,2) check (peso_kg > 0),
  add column comprimento_cm numeric(7,2) check (comprimento_cm > 0),
  add column largura_cm numeric(7,2) check (largura_cm > 0),
  add column altura_cm numeric(7,2) check (altura_cm > 0);

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
  fm.miniaturas as fotos_materiais,
  c.peso_kg, c.comprimento_cm, c.largura_cm, c.altura_cm
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
