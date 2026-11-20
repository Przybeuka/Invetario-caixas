import { ArrowLeft, Check, CheckCheck, Minus, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAvisos } from '../components/avisos'
import { Miniatura } from '../components/Imagens'
import { modeloDoMaterial, ordenarMateriais } from '../lib/materiaisCaixa'
import { Botao, Carregando, classeBotao, PassoQuantidade, Vazio } from '../components/ui'
import { registrarConferencia, useAcao, useCaixas, useCores, useItens, type ItemConferido } from '../lib/api'
import type { CaixaItem } from '../lib/tipos'
import { useTravaSaida } from '../lib/travaSaida'
import { cn, formatarQtd } from '../lib/util'

type Marca =
  | { estado: 'pendente' }
  | { estado: 'ok' }
  | { estado: 'incompleto'; encontrada: number; obs: string }
  | { estado: 'nao'; obs: string }

const ROTULO: Record<Exclude<Marca['estado'], 'pendente'>, string> = {
  ok: 'Completo',
  incompleto: 'Incompleto',
  nao: 'Não encontrado',
}

function LinhaConferir({
  item,
  modelo,
  marca,
  aoMarcar,
}: {
  item: CaixaItem
  modelo: string | null
  marca: Marca
  aoMarcar: (m: Marca) => void
}) {
  const esperada = Number(item.quantidade)
  const capa = [...(item.material.fotos ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.caminho_miniatura
  // Só faz sentido "incompleto" quando há mais de uma unidade esperada.
  const podeIncompleto = esperada > 1
  const botao = 'inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold uppercase tracking-wider transition'
  return (
    <li
      className={cn(
        'cartao flex flex-col gap-3 p-3 transition',
        marca.estado === 'ok' && 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30',
        marca.estado === 'incompleto' && 'border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30',
        marca.estado === 'nao' && 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30',
      )}
    >
      <div className="flex items-center gap-3">
        <Miniatura caminho={capa} modelo={modelo} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-snug">{item.material.nome}</div>
          <div className="text-sm text-zinc-500">
            Esperado:{' '}
            <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatarQtd(esperada)}</span>{' '}
            {item.material.unidade}
          </div>
        </div>
        {marca.estado !== 'pendente' && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rotulo',
                marca.estado === 'ok' && 'text-emerald-700 dark:text-emerald-300',
                marca.estado === 'incompleto' && 'text-amber-700 dark:text-amber-300',
                marca.estado === 'nao' && 'text-red-700 dark:text-red-300',
              )}
            >
              {ROTULO[marca.estado]}
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
      {marca.estado === 'pendente' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => aoMarcar({ estado: 'ok' })}
            className={cn(botao, 'bg-emerald-600 text-white hover:bg-emerald-700')}
          >
            <Check className="size-4" strokeWidth={3} /> Completo
          </button>
          {podeIncompleto && (
            <button
              type="button"
              onClick={() => aoMarcar({ estado: 'incompleto', encontrada: esperada - 1, obs: '' })}
              className={cn(
                botao,
                'border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-zinc-900 dark:text-amber-300',
              )}
            >
              <Minus className="size-4" /> Incompleto
            </button>
          )}
          <button
            type="button"
            onClick={() => aoMarcar({ estado: 'nao', obs: '' })}
            className={cn(
              botao,
              'border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300',
            )}
          >
            <X className="size-4" strokeWidth={3} /> Não encontrado
          </button>
        </div>
      )}
      {marca.estado === 'incompleto' && (
        <div className="flex flex-col gap-2 border-t border-amber-200 pt-3 sm:flex-row sm:items-center dark:border-amber-900/60">
          <div className="flex items-center gap-3">
            <span className="rotulo">Encontrado</span>
            <PassoQuantidade
              valor={marca.encontrada}
              min={1}
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
      {marca.estado === 'nao' && (
        <div className="border-t border-red-200 pt-3 dark:border-red-900/60">
          <input
            className="campo h-11 w-full py-2"
            placeholder="O que aconteceu? (opcional)"
            value={marca.obs}
            onChange={(e) => aoMarcar({ ...marca, obs: e.target.value })}
          />
        </div>
      )}
    </li>
  )
}

type Rascunho = { marcas: Record<string, Marca>; observacao: string; pendencia: boolean; em: number }
const chaveRascunho = (caixaId: string) => `conferencia-rascunho:${caixaId}`

function lerRascunho(caixaId: string): Rascunho | null {
  try {
    const bruto = localStorage.getItem(chaveRascunho(caixaId))
    return bruto ? (JSON.parse(bruto) as Rascunho) : null
  } catch {
    return null
  }
}

export function Conferir() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: caixas = [], isLoading } = useCaixas()
  const caixa = caixas.find((c) => c.id === id)
  const { data: itensBrutos = [], isLoading: carregandoItens } = useItens(id)
  const { data: cores = [] } = useCores()
  const itens = useMemo(() => ordenarMateriais(itensBrutos, (i) => i.material.nome, cores), [itensBrutos, cores])
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [observacao, setObservacao] = useState('')
  const [pendencia, setPendencia] = useState(false)
  const { avisar, confirmar, escolher } = useAvisos()
  const [recuperadoEm, setRecuperadoEm] = useState<number | null>(null)
  const [salvo, setSalvo] = useState(false)
  const restaurou = useRef(false)

  // Rascunho automático: recupera o que já foi marcado nesta caixa (só para itens que ainda existem).
  useEffect(() => {
    if (restaurou.current || carregandoItens || !itensBrutos.length) return
    restaurou.current = true
    const r = lerRascunho(id)
    if (!r) return
    const marcasValidas: Record<string, Marca> = {}
    for (const i of itensBrutos) {
      const m = r.marcas?.[i.id]
      if (!m || m.estado === 'pendente') continue
      if (m.estado === 'incompleto' && !(m.encontrada >= 1 && m.encontrada < Number(i.quantidade))) continue
      marcasValidas[i.id] = m
    }
    if (!Object.keys(marcasValidas).length && !r.observacao && !r.pendencia) return
    setMarcas(marcasValidas)
    setObservacao(r.observacao ?? '')
    setPendencia(!!r.pendencia)
    setRecuperadoEm(r.em)
  }, [id, itensBrutos, carregandoItens])

  const marcaDe = (itemId: string): Marca => marcas[itemId] ?? { estado: 'pendente' }
  const verificados = itens.filter((i) => marcaDe(i.id).estado !== 'pendente').length
  const faltas = itens.filter((i) => {
    const e = marcaDe(i.id).estado
    return e === 'incompleto' || e === 'nao'
  }).length
  const completo = verificados === itens.length

  const temProgresso = verificados > 0 || observacao.trim() !== '' || pendencia

  function gravarRascunho() {
    try {
      if (temProgresso) {
        const r: Rascunho = { marcas, observacao, pendencia, em: Date.now() }
        localStorage.setItem(chaveRascunho(id), JSON.stringify(r))
      } else {
        localStorage.removeItem(chaveRascunho(id))
      }
    } catch {
      /* sem armazenamento disponível: segue sem rascunho */
    }
  }

  // Salva sozinho a cada mudança (depois de recuperar o rascunho anterior, para não sobrescrevê-lo).
  useEffect(() => {
    if (salvo || (!restaurou.current && !!lerRascunho(id))) return
    const t = setTimeout(gravarRascunho, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas, observacao, pendencia, salvo, id])

  useTravaSaida(temProgresso && !salvo, async () => {
    const r = await escolher({
      titulo: 'Salvar antes de sair?',
      mensagem:
        'A conferência ainda não foi registrada. Sim guarda o que você marcou como rascunho neste aparelho; Não apaga as marcações.',
      sim: 'Sim, salvar rascunho',
      nao: 'Não salvar',
      cancelar: 'Continuar conferindo',
    })
    if (r === 'cancelar') return false
    if (r === 'sim') gravarRascunho()
    else {
      try {
        localStorage.removeItem(chaveRascunho(id))
      } catch {
        /* sem armazenamento: nada a apagar */
      }
    }
    return true
  })

  async function descartarRascunho() {
    const ok = await confirmar({
      titulo: 'Descartar o rascunho?',
      mensagem: 'Todas as marcações desta conferência serão apagadas.',
      confirmar: 'Descartar',
      cancelar: 'Manter',
      perigo: true,
    })
    if (!ok) return
    setMarcas({})
    setObservacao('')
    setPendencia(false)
    setRecuperadoEm(null)
    try {
      localStorage.removeItem(chaveRascunho(id))
    } catch {
      /* ignora */
    }
  }

  const payload = useMemo<ItemConferido[]>(
    () =>
      itens.map((i) => {
        const m = marcas[i.id] ?? { estado: 'pendente' }
        const esperada = Number(i.quantidade)
        return {
          material_id: i.material_id,
          material_nome: i.material.nome,
          quantidade_esperada: esperada,
          quantidade_encontrada: m.estado === 'incompleto' ? m.encontrada : m.estado === 'nao' ? 0 : esperada,
          observacao: m.estado === 'incompleto' || m.estado === 'nao' ? m.obs.trim() || null : null,
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

      {recuperadoEm && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <span className="min-w-0 flex-1">
            Rascunho recuperado de {new Date(recuperadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
            Continue de onde parou.
          </span>
          <button type="button" onClick={() => void descartarRascunho()} className="font-semibold underline">
            Descartar rascunho
          </button>
        </div>
      )}

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
                modelo={modeloDoMaterial(item.material.nome, cores, caixa?.tamanho)}
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
          <div className="flex gap-2">
            <Botao
              tamanho="lg"
              disabled={!temProgresso}
              onClick={() => {
                gravarRascunho()
                avisar('Rascunho salvo neste aparelho.')
              }}
            >
              Salvar rascunho
            </Botao>
            <Botao
              variante={faltas || pendencia ? 'perigo' : 'primario'}
              tamanho="lg"
              disabled={!completo}
              carregando={salvar.isPending}
              onClick={() =>
                salvar.mutate(undefined, {
                  onSuccess: () => {
                    setSalvo(true)
                    try {
                      localStorage.removeItem(chaveRascunho(id))
                    } catch {
                      /* ignora */
                    }
                    navigate(`/caixas/${caixa.id}`, { replace: true })
                  },
                })
              }
              className="flex-1 sm:min-w-64"
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
    </div>
  )
}
