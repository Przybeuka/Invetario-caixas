import { ArrowLeft, Check, CheckCheck, Minus, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Miniatura } from '../components/Imagens'
import { Botao, Carregando, classeBotao, PassoQuantidade, Vazio } from '../components/ui'
import { registrarConferencia, useAcao, useCaixas, useItens, type ItemConferido } from '../lib/api'
import type { CaixaItem } from '../lib/tipos'
import { cn, formatarQtd } from '../lib/util'

type Marca = { estado: 'pendente' } | { estado: 'ok' } | { estado: 'falta'; encontrada: number; obs: string }

function LinhaConferir({
  item,
  marca,
  aoMarcar,
}: {
  item: CaixaItem
  marca: Marca
  aoMarcar: (m: Marca) => void
}) {
  const esperada = Number(item.quantidade)
  const capa = [...(item.material.fotos ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.caminho_miniatura
  return (
    <li
      className={cn(
        'cartao flex flex-col gap-3 p-3 transition',
        marca.estado === 'ok' && 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30',
        marca.estado === 'falta' && 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30',
      )}
    >
      <div className="flex items-center gap-3">
        <Miniatura caminho={capa} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{item.material.nome}</div>
          <div className="text-sm text-zinc-500">
            Esperado:{' '}
            <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatarQtd(esperada)}</span>{' '}
            {item.material.unidade}
          </div>
        </div>
        {marca.estado === 'pendente' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aoMarcar({ estado: 'falta', encontrada: Math.max(0, esperada - 1), obs: '' })}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 text-xs font-bold uppercase tracking-wider text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300"
            >
              <Minus className="size-4" /> Falta
            </button>
            <button
              type="button"
              onClick={() => aoMarcar({ estado: 'ok' })}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-700"
            >
              <Check className="size-4" strokeWidth={3} /> Completo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rotulo',
                marca.estado === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
              )}
            >
              {marca.estado === 'ok' ? 'Completo' : 'Em falta'}
            </span>
            <button
              type="button"
              aria-label="Desfazer"
              onClick={() => aoMarcar({ estado: 'pendente' })}
              className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            >
              <Undo2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      {marca.estado === 'falta' && (
        <div className="flex flex-col gap-2 border-t border-red-200 pt-3 sm:flex-row sm:items-center dark:border-red-900/60">
          <div className="flex items-center gap-3">
            <span className="rotulo">Encontrado</span>
            <PassoQuantidade
              valor={marca.encontrada}
              min={0}
              max={esperada}
              aoMudar={(v) => aoMarcar(v >= esperada ? { estado: 'ok' } : { ...marca, encontrada: v })}
            />
          </div>
          <input
            className="campo h-11 flex-1 py-2"
            placeholder="O que aconteceu? (opcional)"
            value={marca.obs}
            onChange={(e) => aoMarcar({ ...marca, obs: e.target.value })}
          />
        </div>
      )}
    </li>
  )
}

export function Conferir() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: caixas = [], isLoading } = useCaixas()
  const caixa = caixas.find((c) => c.id === id)
  const { data: itens = [], isLoading: carregandoItens } = useItens(id)
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [observacao, setObservacao] = useState('')
  const [pendencia, setPendencia] = useState(false)

  const marcaDe = (itemId: string): Marca => marcas[itemId] ?? { estado: 'pendente' }
  const verificados = itens.filter((i) => marcaDe(i.id).estado !== 'pendente').length
  const faltas = itens.filter((i) => marcaDe(i.id).estado === 'falta').length
  const completo = verificados === itens.length

  const payload = useMemo<ItemConferido[]>(
    () =>
      itens.map((i) => {
        const m = marcas[i.id] ?? { estado: 'pendente' }
        const esperada = Number(i.quantidade)
        return {
          material_id: i.material_id,
          material_nome: i.material.nome,
          quantidade_esperada: esperada,
          quantidade_encontrada: m.estado === 'falta' ? m.encontrada : esperada,
          observacao: m.estado === 'falta' ? m.obs.trim() || null : null,
        }
      }),
    [itens, marcas],
  )

  const salvar = useAcao(
    () => registrarConferencia({ caixaId: id, itens: payload, observacao, pendencia }),
    () => (faltas || pendencia ? 'Conferência registrada com pendência.' : 'Conferência registrada. Tudo certo!'),
  )

  if (isLoading || carregandoItens) return <Carregando />
  if (!caixa)
    return (
      <Vazio
        titulo="Caixa não encontrada"
        acao={
          <Link to="/" className={classeBotao('primario')}>
            Voltar
          </Link>
        }
      />
    )

  return (
    <div className="flex flex-col gap-5 pb-56">
      <Link
        to={`/caixas/${caixa.id}`}
        className="rotulo inline-flex items-center gap-1.5 self-start hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Caixa {caixa.numero}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="rotulo">Conferência</div>
          <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            Caixa {caixa.numero} · {caixa.nome}
          </h1>
        </div>
        {itens.length > 0 && verificados < itens.length && (
          <Botao
            variante="sucesso"
            icone={<CheckCheck className="size-4" />}
            onClick={() =>
              setMarcas((atual) => {
                const novas = { ...atual }
                for (const i of itens) if (!novas[i.id] || novas[i.id].estado === 'pendente') novas[i.id] = { estado: 'ok' }
                return novas
              })
            }
          >
            Marcar restantes como completos
          </Botao>
        )}
      </header>

      {itens.length ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={cn('h-full rounded-full transition-all', faltas ? 'bg-red-500' : 'bg-emerald-500')}
                style={{ width: `${(verificados / itens.length) * 100}%` }}
              />
            </div>
            <span className="rotulo whitespace-nowrap">
              {verificados} de {itens.length} verificados
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {itens.map((item) => (
              <LinhaConferir
                key={item.id}
                item={item}
                marca={marcaDe(item.id)}
                aoMarcar={(m) => setMarcas((atual) => ({ ...atual, [item.id]: m }))}
              />
            ))}
          </ul>
        </>
      ) : (
        <Vazio
          titulo="Caixa sem materiais cadastrados"
          texto="Você ainda pode registrar que a caixa foi verificada, com uma observação."
        />
      )}

      <div className="nao-imprimir fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <input
              className="campo h-11 py-2"
              placeholder="Observação geral (opcional)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-red-600"
                checked={pendencia}
                onChange={(e) => setPendencia(e.target.checked)}
              />
              Registrar com pendência (ex.: material danificado)
            </label>
          </div>
          <Botao
            variante={faltas || pendencia ? 'perigo' : 'primario'}
            tamanho="lg"
            disabled={!completo}
            carregando={salvar.isPending}
            onClick={() =>
              salvar.mutate(undefined, { onSuccess: () => navigate(`/caixas/${caixa.id}`, { replace: true }) })
            }
            className="sm:min-w-64"
          >
            {!completo
              ? itens.length - verificados === 1
                ? 'Falta verificar 1 item'
                : `Faltam ${itens.length - verificados} itens`
              : faltas || pendencia
                ? 'Salvar com pendência'
                : 'Salvar conferência'}
          </Botao>
        </div>
      </div>
    </div>
  )
}
