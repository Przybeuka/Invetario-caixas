import { Check, Clock, TriangleAlert, X } from 'lucide-react'
import type { EstadoCaixa } from '../lib/tipos'
import { cn, formatarDataCurta } from '../lib/util'

export const ROTULO_ESTADO: Record<EstadoCaixa, string> = {
  ok: 'Conferida',
  vencida: 'Conferência vencida',
  pendencia: 'Com pendência',
  nunca: 'Não conferida',
}

const ESTILO: Record<EstadoCaixa, string> = {
  ok: 'bg-emerald-500 text-white ring-2 ring-white dark:ring-zinc-900',
  vencida: 'bg-amber-500 text-white ring-2 ring-white dark:ring-zinc-900',
  pendencia: 'bg-red-600 text-white ring-2 ring-white dark:ring-zinc-900',
  nunca: 'bg-white text-red-600 ring-[3px] ring-red-600',
}

function Icone({ estado, className }: { estado: EstadoCaixa; className?: string }) {
  if (estado === 'ok') return <Check className={className} strokeWidth={3} />
  if (estado === 'vencida') return <Clock className={className} strokeWidth={2.5} />
  if (estado === 'pendencia') return <TriangleAlert className={className} strokeWidth={2.5} />
  return <X className={className} strokeWidth={3} />
}

/** Ícone redondo de conferência que fica sobre a foto. */
export function StatusIcone({
  estado,
  tamanho = 'md',
  className,
}: {
  estado: EstadoCaixa
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dimensao = tamanho === 'sm' ? 'size-6' : tamanho === 'lg' ? 'size-10' : 'size-8'
  const icone = tamanho === 'sm' ? 'size-3.5' : tamanho === 'lg' ? 'size-5' : 'size-4'
  return (
    <span
      role="img"
      title={ROTULO_ESTADO[estado]}
      aria-label={ROTULO_ESTADO[estado]}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full shadow-md', dimensao, ESTILO[estado], className)}
    >
      <Icone estado={estado} className={icone} />
    </span>
  )
}

const ESTILO_SELO: Record<EstadoCaixa, string> = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900',
  vencida: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900',
  pendencia: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900',
  nunca: 'bg-white text-red-700 ring-red-300 dark:bg-zinc-900 dark:text-red-300 dark:ring-red-900',
}

/** Selo de texto com a situação e a data da última conferência. */
export function SeloEstado({
  estado,
  data,
  className,
}: {
  estado: EstadoCaixa
  data?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1',
        ESTILO_SELO[estado],
        className,
      )}
    >
      <Icone estado={estado} className="size-3.5" />
      {ROTULO_ESTADO[estado]}
      {data && estado !== 'nunca' && <span className="font-semibold opacity-75">· {formatarDataCurta(data)}</span>}
    </span>
  )
}
