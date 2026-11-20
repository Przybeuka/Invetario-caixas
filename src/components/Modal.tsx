import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/util'
import { useAvisosOpcional } from './avisos'

/** Janela modal baseada em <dialog> (funciona bem no Safari do iPad). */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  largura = 'max-w-lg',
  protegido = false,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  rodape?: ReactNode
  largura?: string
  /** Pede confirmação antes de fechar (X, fora da janela ou Esc) se algum campo foi mexido. */
  protegido?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const avisos = useAvisosOpcional()
  const [mexeu, setMexeu] = useState(false)

  useEffect(() => {
    if (!aberto) setMexeu(false)
  }, [aberto])

  const marcar = useCallback(() => setMexeu(true), [])

  const tentarFechar = useCallback(async () => {
    if (protegido && mexeu && avisos) {
      const r = await avisos.escolher({
        titulo: 'Salvar alterações?',
        mensagem: 'Você mudou alguns campos. Quer salvar antes de sair?',
        sim: 'Sim, salvar',
        nao: 'Não salvar',
        cancelar: 'Continuar editando',
      })
      if (r === 'cancelar') return
      if (r === 'sim') {
        // Aciona o botão de salvar do próprio formulário (que valida os campos); a janela fecha quando salvar.
        const salvar = ref.current?.querySelector<HTMLButtonElement>('footer button[type="submit"]')
        if (salvar) {
          salvar.click()
          return
        }
      }
    }
    aoFechar()
  }, [protegido, mexeu, avisos, aoFechar])

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        void tentarFechar()
      }}
      onClick={(e) => {
        if (e.target === ref.current) void tentarFechar()
      }}
      className={cn(
        'm-auto w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
        largura,
      )}
    >
      {aberto && (
        <div className="flex max-h-[min(88dvh,860px)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold leading-tight">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={() => void tentarFechar()}
              aria-label="Fechar"
              className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-5" />
            </button>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
            onInput={protegido ? marcar : undefined}
            onChange={protegido ? marcar : undefined}
            onClick={
              protegido
                ? (e) => {
                    if ((e.target as HTMLElement).closest('button')) marcar()
                  }
                : undefined
            }
          >
            {children}
          </div>
          {rodape && (
            <footer className="border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              {rodape}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
