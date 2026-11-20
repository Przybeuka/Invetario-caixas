import { LoaderCircle, Minus, Plus, Search, X } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn, formatarQtd } from '../lib/util'

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso'
export type TamanhoBotao = 'sm' | 'md' | 'lg'

const VARIANTES: Record<VarianteBotao, string> = {
  primario:
    'bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
  secundario:
    'border border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  fantasma: 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800',
  perigo: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  sucesso: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
}

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-11 gap-2 rounded-xl px-4 text-[13px]',
  lg: 'h-12 gap-2 rounded-xl px-5 text-sm',
}

export function classeBotao(variante: VarianteBotao = 'secundario', tamanho: TamanhoBotao = 'md') {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold uppercase tracking-wider transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[variante],
    TAMANHOS[tamanho],
  )
}

interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  tamanho?: TamanhoBotao
  icone?: ReactNode
  carregando?: boolean
}

export function Botao({
  variante = 'secundario',
  tamanho = 'md',
  icone,
  carregando,
  className,
  children,
  disabled,
  type = 'button',
  ...resto
}: PropsBotao) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={cn(classeBotao(variante, tamanho), className)}
      {...resto}
    >
      {carregando ? <LoaderCircle className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

export function BotaoIcone({
  rotulo,
  children,
  className,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-200/70 active:scale-95 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** O "círculo preto de notificação" com a quantidade de caixas. */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  return (
    <span
      aria-label={`${valor} ${valor === 1 ? 'caixa' : 'caixas'}`}
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-zinc-900 px-2 font-display text-lg font-bold leading-none text-white shadow-md ring-2 ring-white dark:bg-white dark:text-zinc-900 dark:ring-zinc-900',
        className,
      )}
    >
      {valor}
    </span>
  )
}

export function Ponto({ hex, className }: { hex: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-3 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/20', className)}
      style={{ background: hex }}
    />
  )
}

export function RotuloCor({ nome, hex, className }: { nome: string; hex: string; className?: string }) {
  return (
    <span className={cn('rotulo inline-flex items-center gap-1.5', className)}>
      <Ponto hex={hex} />
      {nome}
    </span>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
      <LoaderCircle className="size-5 animate-spin" />
      <span className="rotulo">{texto}</span>
    </div>
  )
}

export function Vazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone?: ReactNode
  titulo: string
  texto?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="cartao flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icone && <div className="text-zinc-400">{icone}</div>}
      <h2 className="font-display text-2xl font-bold">{titulo}</h2>
      {texto && <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">{texto}</p>}
      {acao}
    </div>
  )
}

export function ErroCarga({ erro }: { erro: unknown }) {
  const msg = (erro as { message?: string } | null)?.message ?? 'Erro desconhecido'
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      Não foi possível carregar os dados. {msg}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------

export interface OpcaoSegmentada<T extends string> {
  valor: T
  rotulo: string
  icone?: ReactNode
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  className,
  rotulo,
}: {
  opcoes: OpcaoSegmentada<T>[]
  valor: T
  aoMudar: (v: T) => void
  className?: string
  rotulo?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cn(
        'inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => aoMudar(o.valor)}
          className={cn(
            'inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold uppercase tracking-wider transition',
            valor === o.valor
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
          )}
        >
          {o.icone}
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Chip({
  ativo,
  children,
  className,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold uppercase tracking-wider transition active:scale-[0.98]',
        ativo
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600',
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  )
}

export function CampoBusca({
  valor,
  aoMudar,
  placeholder,
  className,
  autoFocus,
}: {
  valor: string
  aoMudar: (v: string) => void
  placeholder: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="campo h-12 pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          <X className="size-4" />
        </button>
      )}
    </label>
  )
}

function arredondar(n: number) {
  return Math.round(n * 100) / 100
}

export function PassoQuantidade({
  valor,
  aoMudar,
  min = 0,
  max,
  desabilitado,
  className,
}: {
  valor: number
  aoMudar: (v: number) => void
  min?: number
  max?: number
  desabilitado?: boolean
  className?: string
}) {
  const [texto, setTexto] = useState(formatarQtd(valor))
  useEffect(() => setTexto(formatarQtd(valor)), [valor])

  function aplicar(n: number) {
    let v = arredondar(n)
    if (v < min) v = min
    if (max !== undefined && v > max) v = max
    setTexto(formatarQtd(v))
    if (v !== valor) aoMudar(v)
  }

  return (
    <div
      className={cn(
        'inline-flex h-11 items-stretch overflow-hidden rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900',
        desabilitado && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Diminuir"
        disabled={desabilitado || valor <= min}
        onClick={() => aplicar(valor - 1)}
        className="flex w-11 items-center justify-center text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="decimal"
        aria-label="Quantidade"
        disabled={desabilitado}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const n = Number(texto.replace(/\./g, '').replace(',', '.'))
          if (Number.isFinite(n)) aplicar(n)
          else setTexto(formatarQtd(valor))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="w-14 border-x border-zinc-200 bg-transparent text-center font-display text-xl font-bold tabular-nums outline-none dark:border-zinc-700"
      />
      <button
        type="button"
        aria-label="Aumentar"
        disabled={desabilitado || (max !== undefined && valor >= max)}
        onClick={() => aplicar(valor + 1)}
        className="flex w-11 items-center justify-center text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string
  dica?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="rotulo">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-zinc-500 dark:text-zinc-400">{dica}</span>}
    </label>
  )
}

/** Menu suspenso simples (fecha ao clicar fora). */
export function Menu({ botao, children }: { botao: (abrir: () => void) => ReactNode; children: (fechar: () => void) => ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])
  return (
    <div ref={ref} className="relative">
      {botao(() => setAberto((a) => !a))}
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 min-w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  )
}

export function ItemMenu({
  icone,
  children,
  perigo,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { icone?: ReactNode; perigo?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800',
        perigo ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-200',
      )}
      {...resto}
    >
      {icone}
      {children}
    </button>
  )
}

export function Secao({
  titulo,
  acao,
  children,
  className,
}: {
  titulo: ReactNode
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  )
}
