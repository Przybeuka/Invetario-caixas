import { ChevronDown, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Botao, CampoBusca, Carregando, Chip, ErroCarga, Vazio } from '../components/ui'
import { useCores, useHistorico, type FiltroHistorico } from '../lib/api'
import type { Cor, RegistroHistorico } from '../lib/tipos'
import { cn, formatarData, formatarHora, formatarQtd, ROTULO_TAMANHO } from '../lib/util'

const TABELAS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'caixas', rotulo: 'Caixas' },
  { valor: 'caixa_itens', rotulo: 'Conteúdo' },
  { valor: 'materiais', rotulo: 'Materiais' },
  { valor: 'conferencias', rotulo: 'Conferências' },
  { valor: 'fotos', rotulo: 'Fotos' },
]

const CAMPOS: Record<string, string> = {
  numero: 'Número',
  nome: 'Nome',
  cor_id: 'Cor',
  tamanho: 'Tamanho',
  local: 'Local',
  observacoes: 'Observações',
  foto_modelo: 'Foto do modelo',
  quantidade: 'Quantidade',
  observacao: 'Observação',
  unidade: 'Unidade',
  categoria: 'Categoria',
  descricao: 'Descrição',
  status: 'Situação',
}

const IGNORAR = new Set(['id', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por', 'caixa_id', 'material_id', 'ordem'])

function valorLegivel(campo: string, valor: unknown, cores: Cor[]): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (campo === 'cor_id') return cores.find((c) => c.id === valor)?.nome ?? 'cor removida'
  if (campo === 'tamanho') return ROTULO_TAMANHO[valor as keyof typeof ROTULO_TAMANHO] ?? String(valor)
  if (campo === 'quantidade') return formatarQtd(valor as number)
  return String(valor)
}

function Diferencas({ r, cores }: { r: RegistroHistorico; cores: Cor[] }) {
  if (r.acao === 'alterou' && r.antes && r.depois) {
    const mudancas = Object.keys(r.depois).filter(
      (k) => !IGNORAR.has(k) && JSON.stringify(r.antes?.[k]) !== JSON.stringify(r.depois?.[k]),
    )
    if (!mudancas.length) return <p className="text-zinc-500">Sem mudanças visíveis.</p>
    return (
      <ul className="flex flex-col gap-1">
        {mudancas.map((k) => (
          <li key={k}>
            <span className="font-semibold">{CAMPOS[k] ?? k}:</span>{' '}
            <span className="text-zinc-500 line-through">{valorLegivel(k, r.antes?.[k], cores)}</span> →{' '}
            <span>{valorLegivel(k, r.depois?.[k], cores)}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (r.acao === 'excluiu' && r.antes) {
    const itens = r.antes.itens as { material: string; quantidade: number }[] | undefined
    const caixas = r.antes.caixas as { numero: number; nome: string; quantidade: number }[] | undefined
    if (itens?.length)
      return (
        <div>
          <p className="mb-1 font-semibold">Conteúdo que a caixa tinha:</p>
          <ul className="columns-1 sm:columns-2">
            {itens.map((i) => (
              <li key={i.material}>
                {formatarQtd(i.quantidade)} × {i.material}
              </li>
            ))}
          </ul>
        </div>
      )
    if (caixas?.length)
      return (
        <div>
          <p className="mb-1 font-semibold">Estava nas caixas:</p>
          <ul>
            {caixas.map((c) => (
              <li key={c.numero}>
                Nº {c.numero} · {c.nome} ({formatarQtd(c.quantidade)})
              </li>
            ))}
          </ul>
        </div>
      )
  }
  const dados = r.depois ?? r.antes
  if (!dados) return null
  const campos = Object.keys(dados).filter((k) => !IGNORAR.has(k) && dados[k] !== null && CAMPOS[k])
  if (!campos.length) return null
  return (
    <ul className="flex flex-col gap-1">
      {campos.map((k) => (
        <li key={k}>
          <span className="font-semibold">{CAMPOS[k]}:</span> {valorLegivel(k, dados[k], cores)}
        </li>
      ))}
    </ul>
  )
}

function Linha({ r, cores }: { r: RegistroHistorico; cores: Cor[] }) {
  const [aberto, setAberto] = useState(false)
  const Icone = r.acao === 'criou' ? Plus : r.acao === 'alterou' ? Pencil : Trash2
  const verbo = r.acao === 'criou' ? 'Criou' : r.acao === 'alterou' ? 'Alterou' : 'Excluiu'
  const rotuloTabela = TABELAS.find((t) => t.valor === r.tabela)?.rotulo
  return (
    <li className="py-3">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-start gap-3 text-left">
        <span
          className={cn(
            'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full',
            r.acao === 'criou' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
            r.acao === 'alterou' && 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
            r.acao === 'excluiu' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
          )}
        >
          <Icone className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">
            <span className="font-semibold">{verbo}</span> {r.resumo ?? rotuloTabela}
          </span>
          <span className="block text-xs text-zinc-500">
            {r.usuario_nome ?? 'Sistema'} · {formatarHora(r.criado_em)}
            {rotuloTabela && <> · {rotuloTabela}</>}
          </span>
        </span>
        <ChevronDown className={cn('mt-1 size-5 shrink-0 text-zinc-400 transition', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="ml-11 mt-2 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-950/50">
          <Diferencas r={r} cores={cores} />
        </div>
      )}
    </li>
  )
}

function rotuloDia(iso: string): string {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return formatarData(iso)
}

export function Historico() {
  const [tabela, setTabela] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setBuscaAplicada(busca), 350)
    return () => window.clearTimeout(t)
  }, [busca])
  const filtro: FiltroHistorico = useMemo(() => ({ tabela, busca: buscaAplicada }), [tabela, buscaAplicada])
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useHistorico(filtro)
  const { data: cores = [] } = useCores()
  const registros = useMemo(() => data?.pages.flat() ?? [], [data])

  const porDia = useMemo(() => {
    const grupos: { dia: string; itens: RegistroHistorico[] }[] = []
    for (const r of registros) {
      const dia = rotuloDia(r.criado_em)
      const ultimo = grupos[grupos.length - 1]
      if (ultimo?.dia === dia) ultimo.itens.push(r)
      else grupos.push({ dia, itens: [r] })
    }
    return grupos
  }, [registros])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-bold">Histórico</h1>
        <p className="text-sm text-zinc-500">Tudo o que foi criado, alterado ou excluído, com quem e quando.</p>
      </div>
      <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por caixa ou material" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TABELAS.map((t) => (
          <Chip key={t.valor} ativo={tabela === t.valor} onClick={() => setTabela(t.valor)}>
            {t.rotulo}
          </Chip>
        ))}
      </div>

      {error ? (
        <ErroCarga erro={error} />
      ) : isLoading ? (
        <Carregando />
      ) : !registros.length ? (
        <Vazio icone={<History className="size-10" strokeWidth={1.25} />} titulo="Nada registrado ainda" />
      ) : (
        <div className="flex flex-col gap-6">
          {porDia.map((g) => (
            <section key={g.dia}>
              <h2 className="rotulo mb-2">{g.dia}</h2>
              <ul className="cartao divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
                {g.itens.map((r) => (
                  <Linha key={r.id} r={r} cores={cores} />
                ))}
              </ul>
            </section>
          ))}
          {hasNextPage && (
            <Botao className="self-center" carregando={isFetchingNextPage} onClick={() => fetchNextPage()}>
              Carregar mais
            </Botao>
          )}
        </div>
      )}
    </div>
  )
}
