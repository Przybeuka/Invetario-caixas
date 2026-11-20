import { ArrowRight, Boxes, LayoutGrid, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePermissoes } from '../auth/auth'
import { FormCaixa } from '../components/FormCaixa'
import { ImagemGrupo } from '../components/Imagens'
import { StatusIcone } from '../components/Status'
import {
  Botao,
  CampoBusca,
  Carregando,
  Chip,
  Contador,
  ErroCarga,
  Ponto,
  RotuloCor,
  Segmentado,
  Vazio,
} from '../components/ui'
import { useCaixas, useCores, useValidade } from '../lib/api'
import {
  agrupar,
  combinaBusca,
  corDoGrupo,
  linkDoGrupo,
  resumoMateriais,
  resumoTamanho,
  type Grupo,
} from '../lib/grupos'
import { cn, normalizar } from '../lib/util'

type Visao = 'lista' | 'grade'

function lerVisao(): Visao {
  try {
    return localStorage.getItem('visao') === 'grade' ? 'grade' : 'lista'
  } catch {
    return 'lista'
  }
}

function detalhes(g: Grupo): string[] {
  const partes: string[] = []
  const mat = resumoMateriais(g.caixas)
  if (mat) partes.push(mat)
  const tam = resumoTamanho(g.caixas)
  if (tam) partes.push(tam)
  if (g.caixas.length > 1 && g.conferidas > 0 && g.conferidas < g.caixas.length)
    partes.push(`${g.conferidas}/${g.caixas.length} conferidas`)
  return partes
}

function BotaoVer({ grupo, grande }: { grupo: Grupo; grande?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 font-semibold uppercase tracking-wider text-white transition group-hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:group-hover:bg-zinc-200',
        grande ? 'h-12 px-5 text-sm sm:h-14 sm:px-7 sm:text-base' : 'h-11 px-4 text-[13px]',
      )}
    >
      {grupo.caixas.length === 1 ? 'Ver caixa' : 'Ver caixas'}
      <ArrowRight className="size-4" />
    </span>
  )
}

function CartaoLista({ grupo }: { grupo: Grupo }) {
  return (
    <Link
      to={linkDoGrupo(grupo)}
      className="group cartao relative flex overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span aria-hidden className="w-1.5 shrink-0" style={{ background: corDoGrupo(grupo) }} />
      <div className="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-3 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6 sm:p-4">
        <div className="relative aspect-[4/3] w-28 overflow-hidden rounded-xl bg-zinc-100 sm:row-span-1 sm:w-44 dark:bg-zinc-800">
          <ImagemGrupo grupo={grupo} />
          <StatusIcone estado={grupo.estado} className="absolute left-2 top-2" />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 pr-10 sm:pr-0">
          <h2 className="truncate font-display text-[28px] font-bold leading-none tracking-tight sm:text-4xl">
            {grupo.nome}
          </h2>
          <p className="rotulo flex flex-wrap gap-x-4 gap-y-1">
            {detalhes(grupo).map((d) => (
              <span key={d}>{d}</span>
            ))}
          </p>
        </div>

        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:h-full sm:flex-col sm:items-end sm:justify-between">
          <Contador valor={grupo.caixas.length} className="absolute right-3 top-3 sm:static" />
          <BotaoVer grupo={grupo} grande />
          <span className="flex flex-col items-end gap-1">
            {grupo.cores.map((c) => (
              <RotuloCor key={c.nome} nome={c.nome} hex={c.hex} />
            ))}
          </span>
        </div>
      </div>
    </Link>
  )
}

function CartaoGrade({ grupo }: { grupo: Grupo }) {
  return (
    <Link
      to={linkDoGrupo(grupo)}
      className="group cartao flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <ImagemGrupo grupo={grupo} />
        <StatusIcone estado={grupo.estado} className="absolute left-3 top-3" />
        <Contador valor={grupo.caixas.length} className="absolute right-3 top-3" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: corDoGrupo(grupo) }} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="truncate font-display text-3xl font-bold leading-none tracking-tight">{grupo.nome}</h2>
        <p className="rotulo flex flex-wrap gap-x-3 gap-y-1">
          {detalhes(grupo).map((d) => (
            <span key={d}>{d}</span>
          ))}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="flex flex-col gap-1">
            {grupo.cores.map((c) => (
              <RotuloCor key={c.nome} nome={c.nome} hex={c.hex} />
            ))}
          </span>
          <BotaoVer grupo={grupo} />
        </div>
      </div>
    </Link>
  )
}

export function Inicio() {
  const { podeEditar } = usePermissoes()
  const { data: caixas = [], isLoading, error } = useCaixas()
  const { data: cores = [] } = useCores()
  const validade = useValidade()
  const [params, setParams] = useSearchParams()
  const [visao, setVisao] = useState<Visao>(lerVisao)
  const [novaAberta, setNovaAberta] = useState(false)

  const busca = params.get('q') ?? ''
  const corFiltro = params.get('cor') ?? ''

  function mudarParam(chave: string, valor: string) {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
  }

  function mudarVisao(v: Visao) {
    setVisao(v)
    try {
      localStorage.setItem('visao', v)
    } catch {
      /* modo privado */
    }
  }

  const termo = normalizar(busca)
  const filtradas = useMemo(
    () => caixas.filter((c) => (!corFiltro || c.cor_id === corFiltro) && combinaBusca(c, termo)),
    [caixas, corFiltro, termo],
  )
  const grupos = useMemo(() => agrupar(filtradas, validade), [filtradas, validade])
  const totalTipos = useMemo(() => new Set(caixas.map((c) => normalizar(c.nome))).size, [caixas])
  const porCor = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of caixas) if (c.cor_id) m.set(c.cor_id, (m.get(c.cor_id) ?? 0) + 1)
    return m
  }, [caixas])

  const filtrando = !!termo || !!corFiltro

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <CampoBusca
          valor={busca}
          aoMudar={(v) => mudarParam('q', v)}
          placeholder="Buscar caixa, número ou material"
          className="flex-1"
        />
        {podeEditar && (
          <Botao
            variante="primario"
            tamanho="lg"
            icone={<Plus className="size-5" />}
            onClick={() => setNovaAberta(true)}
            className="h-12"
          >
            <span className="hidden sm:inline">Nova caixa</span>
          </Botao>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <Chip ativo={!corFiltro} onClick={() => mudarParam('cor', '')}>
            Todas
          </Chip>
          {cores.map((c) => (
            <Chip key={c.id} ativo={corFiltro === c.id} onClick={() => mudarParam('cor', corFiltro === c.id ? '' : c.id)}>
              <Ponto hex={c.hex} className="size-3.5" />
              {c.nome}
              {porCor.get(c.id) ? <span className="opacity-60">{porCor.get(c.id)}</span> : null}
            </Chip>
          ))}
        </div>
        <Segmentado
          rotulo="Modo de exibição"
          valor={visao}
          aoMudar={mudarVisao}
          opcoes={[
            { valor: 'lista', rotulo: 'Lista', icone: <List className="size-4" /> },
            { valor: 'grade', rotulo: 'Grade', icone: <LayoutGrid className="size-4" /> },
          ]}
        />
      </div>

      {error ? (
        <ErroCarga erro={error} />
      ) : isLoading ? (
        <Carregando />
      ) : !caixas.length ? (
        <Vazio
          icone={<Boxes className="size-12" strokeWidth={1.25} />}
          titulo="Nenhuma caixa cadastrada"
          texto={
            podeEditar
              ? 'Comece cadastrando a primeira caixa. Você pode criar várias do mesmo tipo de uma vez.'
              : 'Assim que um editor cadastrar as caixas, elas aparecem aqui.'
          }
          acao={
            podeEditar && (
              <Botao variante="primario" icone={<Plus className="size-4" />} onClick={() => setNovaAberta(true)}>
                Cadastrar caixa
              </Botao>
            )
          }
        />
      ) : (
        <>
          <p className="rotulo">
            {filtrando
              ? `${filtradas.length} de ${caixas.length} caixas · ${grupos.length} ${grupos.length === 1 ? 'tipo' : 'tipos'}`
              : `${caixas.length} caixas · ${totalTipos} ${totalTipos === 1 ? 'tipo' : 'tipos'}`}
          </p>
          {!grupos.length ? (
            <Vazio titulo="Nada encontrado" texto={busca ? `Nenhuma caixa ou material com “${busca}”.` : 'Nenhuma caixa nessa cor.'} />
          ) : visao === 'lista' ? (
            <div className="flex flex-col gap-3">
              {grupos.map((g) => (
                <CartaoLista key={g.chave} grupo={g} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.map((g) => (
                <CartaoGrade key={g.chave} grupo={g} />
              ))}
            </div>
          )}
        </>
      )}

      <FormCaixa aberto={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </div>
  )
}
