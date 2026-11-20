import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '../lib/util'
import { Modal } from './Modal'
import { Botao } from './ui'

type TipoAviso = 'sucesso' | 'erro' | 'info'

interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
}

export interface PedidoConfirmacao {
  titulo: string
  mensagem?: ReactNode
  confirmar?: string
  cancelar?: string
  perigo?: boolean
}

interface ContextoAvisos {
  avisar: (texto: string, tipo?: TipoAviso) => void
  confirmar: (pedido: PedidoConfirmacao) => Promise<boolean>
}

const Ctx = createContext<ContextoAvisos | null>(null)

type ElementoPopover = HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [pedido, setPedido] = useState<(PedidoConfirmacao & { resolver: (v: boolean) => void }) | null>(null)
  const pilha = useRef<ElementoPopover>(null)
  const sequencia = useRef(0)

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'sucesso') => {
    sequencia.current += 1
    const id = sequencia.current
    setAvisos((lista) => [...lista.slice(-2), { id, texto, tipo }])
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === 'erro' ? 6500 : 3500)
  }, [])

  const confirmar = useCallback(
    (p: PedidoConfirmacao) => new Promise<boolean>((resolver) => setPedido({ ...p, resolver })),
    [],
  )

  function responder(valor: boolean) {
    pedido?.resolver(valor)
    setPedido(null)
  }

  // Os avisos ficam numa "camada superior" (popover) para aparecerem acima de janelas abertas.
  const total = avisos.length
  useEffect(() => {
    const el = pilha.current
    if (!el || typeof el.showPopover !== 'function') return
    try {
      el.hidePopover?.()
      if (total) el.showPopover()
    } catch {
      /* navegador sem suporte: o aviso aparece normalmente */
    }
  }, [total])

  const valor = useMemo(() => ({ avisar, confirmar }), [avisar, confirmar])

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        ref={pilha}
        popover="manual"
        className="nao-imprimir pointer-events-none fixed inset-x-0 bottom-0 top-auto m-0 flex h-auto w-full flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'erro' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl',
              a.tipo === 'erro' && 'bg-red-600 text-white',
              a.tipo === 'sucesso' && 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900',
              a.tipo === 'info' && 'bg-blue-600 text-white',
            )}
          >
            {a.tipo === 'erro' ? (
              <CircleAlert className="size-5 shrink-0" />
            ) : a.tipo === 'sucesso' ? (
              <CircleCheck className="size-5 shrink-0 text-emerald-400 dark:text-emerald-600" />
            ) : (
              <Info className="size-5 shrink-0" />
            )}
            {a.texto}
          </div>
        ))}
      </div>
      <Modal
        aberto={!!pedido}
        aoFechar={() => responder(false)}
        titulo={pedido?.titulo ?? ''}
        largura="max-w-md"
        rodape={
          <div className="flex justify-end gap-2">
            <Botao onClick={() => responder(false)}>{pedido?.cancelar ?? 'Cancelar'}</Botao>
            <Botao variante={pedido?.perigo ? 'perigo' : 'primario'} onClick={() => responder(true)}>
              {pedido?.confirmar ?? 'Confirmar'}
            </Botao>
          </div>
        }
      >
        <div className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{pedido?.mensagem}</div>
      </Modal>
    </Ctx.Provider>
  )
}

/** Como useAvisos, mas devolve null fora do provedor (usado pelo Modal, que o provedor também renderiza). */
export function useAvisosOpcional(): ContextoAvisos | null {
  return useContext(Ctx)
}

export function useAvisos(): ContextoAvisos {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAvisos precisa estar dentro de <ProvedorAvisos>')
  return ctx
}
