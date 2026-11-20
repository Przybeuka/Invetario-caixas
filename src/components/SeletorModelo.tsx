import { Check } from 'lucide-react'
import { MODELOS, srcModelo } from '../lib/modelos'
import { cn, normalizar } from '../lib/util'

/** Escolha da foto de referência (modelo) da caixa. */
export function SeletorModelo({
  valor,
  aoMudar,
  corPreferida,
  rotuloVazio = 'Padrão da cor',
}: {
  valor: string | null
  aoMudar: (v: string | null) => void
  corPreferida?: string | null
  rotuloVazio?: string
}) {
  const alvo = normalizar(corPreferida)
  const ordenados = [...MODELOS].sort(
    (a, b) => Number(normalizar(b.cor) === alvo) - Number(normalizar(a.cor) === alvo),
  )
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      <button
        type="button"
        onClick={() => aoMudar(null)}
        className={cn(
          'flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-1 text-center text-[11px] font-semibold uppercase tracking-wider transition',
          valor === null
            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
            : 'border-zinc-300 text-zinc-500 hover:border-zinc-500 dark:border-zinc-700',
        )}
      >
        {rotuloVazio}
      </button>
      {ordenados.map((m) => (
        <button
          key={m.id}
          type="button"
          title={m.rotulo}
          onClick={() => aoMudar(m.id)}
          className={cn(
            'relative aspect-[4/3] overflow-hidden rounded-xl ring-2 ring-offset-2 transition ring-offset-white dark:ring-offset-zinc-900',
            valor === m.id ? 'ring-zinc-900 dark:ring-white' : 'ring-transparent hover:ring-zinc-300',
          )}
        >
          <img src={srcModelo(m.id)} alt={m.rotulo} className="size-full object-cover" loading="lazy" />
          {valor === m.id && (
            <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
