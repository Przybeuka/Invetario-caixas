import { ClipboardCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ROTULO_ESTADO, SeloEstado, StatusIcone } from '../components/Status'
import { Carregando, classeBotao, ErroCarga, Ponto, Vazio } from '../components/ui'
import { useCaixas, useValidade } from '../lib/api'
import { estadoDaCaixa } from '../lib/grupos'
import type { EstadoCaixa } from '../lib/tipos'
import { cn, PRIORIDADE_ESTADO, tempoRelativo } from '../lib/util'

const ORDEM: EstadoCaixa[] = ['pendencia', 'nunca', 'vencida', 'ok']

const ESTILO_BLOCO: Record<EstadoCaixa, string> = {
  pendencia: 'text-red-600 dark:text-red-400',
  nunca: 'text-red-600 dark:text-red-400',
  vencida: 'text-amber-600 dark:text-amber-400',
  ok: 'text-emerald-600 dark:text-emerald-400',
}

export function Conferencias() {
  const { data: caixas = [], isLoading, error } = useCaixas()
  const validade = useValidade()
  const [params, setParams] = useSearchParams()
  const filtro = (params.get('estado') ?? '') as EstadoCaixa | ''

  const lista = useMemo(
    () =>
      caixas
        .map((c) => ({ caixa: c, estado: estadoDaCaixa(c, validade) }))
        .sort(
          (a, b) =>
            PRIORIDADE_ESTADO[a.estado] - PRIORIDADE_ESTADO[b.estado] ||
            (a.caixa.conferido_em ?? '').localeCompare(b.caixa.conferido_em ?? '') ||
            a.caixa.numero - b.caixa.numero,
        ),
    [caixas, validade],
  )
  const contagem = useMemo(() => {
    const m: Record<EstadoCaixa, number> = { pendencia: 0, nunca: 0, vencida: 0, ok: 0 }
    for (const l of lista) m[l.estado] += 1
    return m
  }, [lista])
  const visiveis = filtro ? lista.filter((l) => l.estado === filtro) : lista

  if (error) return <ErroCarga erro={error} />
  if (isLoading) return <Carregando />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-bold">Conferência</h1>
        <p className="text-sm text-zinc-500">
          {validade > 0
            ? `Uma conferência vale ${validade} dias. Depois disso a caixa aparece como vencida.`
            : 'Conferências não vencem (validade desligada nas configurações).'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDEM.map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => {
              const p = new URLSearchParams(params)
              if (filtro === estado) p.delete('estado')
              else p.set('estado', estado)
              setParams(p, { replace: true })
            }}
            className={cn(
              'cartao flex flex-col items-start gap-2 p-4 text-left transition hover:shadow-md',
              filtro === estado && 'ring-2 ring-zinc-900 dark:ring-white',
            )}
          >
            <StatusIcone estado={estado} tamanho="sm" />
            <span className={cn('font-display text-4xl font-bold leading-none', ESTILO_BLOCO[estado])}>{contagem[estado]}</span>
            <span className="rotulo">{ROTULO_ESTADO[estado]}</span>
          </button>
        ))}
      </div>

      {!caixas.length ? (
        <Vazio titulo="Nenhuma caixa cadastrada" />
      ) : !visiveis.length ? (
        <Vazio titulo="Nenhuma caixa nesta situação" />
      ) : (
        <ul className="cartao divide-y divide-zinc-100 dark:divide-zinc-800">
          {visiveis.map(({ caixa, estado }) => (
            <li key={caixa.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <Link to={`/caixas/${caixa.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <StatusIcone estado={estado} tamanho="sm" />
                <span className="w-12 text-center font-display text-3xl font-bold tabular-nums">{caixa.numero}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Ponto hex={caixa.cor_hex ?? '#a1a1aa'} />
                    <span className="truncate font-semibold">{caixa.nome}</span>
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {caixa.conferido_em
                      ? `Conferida ${tempoRelativo(caixa.conferido_em)}${caixa.conferido_por_nome ? ` por ${caixa.conferido_por_nome}` : ''}`
                      : 'Nunca conferida'}
                  </span>
                </span>
                <SeloEstado estado={estado} data={caixa.conferido_em} className="max-md:hidden" />
              </Link>
              <Link to={`/caixas/${caixa.id}/conferir`} className={classeBotao(estado === 'ok' ? 'secundario' : 'primario', 'sm')}>
                <ClipboardCheck className="size-4" />
                <span className="hidden sm:inline">Conferir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
