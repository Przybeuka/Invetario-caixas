import { Check, Images } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFotosExistentes, type FotoExistente } from '../lib/api'
import { urlFoto } from '../lib/supabase'
import { cn } from '../lib/util'
import { Modal } from './Modal'
import { Botao, CampoBusca, Carregando, ErroCarga } from './ui'

/** Janela para escolher fotos que já existem no sistema (de qualquer caixa ou material). */
export function SeletorFotoExistente({
  aberto,
  aoFechar,
  aoConfirmar,
  jaUsadas = [],
}: {
  aberto: boolean
  aoFechar: () => void
  aoConfirmar: (fotos: FotoExistente[]) => void | Promise<void>
  /** Caminhos que o destino já tem (não aparecem de novo). */
  jaUsadas?: string[]
}) {
  const { data, isLoading, error } = useFotosExistentes(aberto)
  const [busca, setBusca] = useState('')
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const usadas = new Set(jaUsadas)
    return (data ?? []).filter((f) => !usadas.has(f.caminho) && (!termo || f.rotulo.toLowerCase().includes(termo)))
  }, [data, busca, jaUsadas])

  function alternar(caminho: string) {
    setEscolhidas((atual) => {
      const novo = new Set(atual)
      if (novo.has(caminho)) novo.delete(caminho)
      else novo.add(caminho)
      return novo
    })
  }

  async function confirmar() {
    const selecionadas = (data ?? []).filter((f) => escolhidas.has(f.caminho))
    setSalvando(true)
    try {
      await aoConfirmar(selecionadas)
      setEscolhidas(new Set())
      setBusca('')
      aoFechar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Usar foto que já existe" largura="max-w-3xl">
      <div className="flex flex-col gap-3">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por caixa ou material" />
        {error ? (
          <ErroCarga erro={error} />
        ) : isLoading ? (
          <Carregando />
        ) : !lista.length ? (
          <p className="py-8 text-center text-sm text-zinc-500">Nenhuma foto encontrada.</p>
        ) : (
          <ul className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {lista.map((f) => {
              const ativa = escolhidas.has(f.caminho)
              return (
                <li key={f.caminho}>
                  <button
                    type="button"
                    onClick={() => alternar(f.caminho)}
                    aria-pressed={ativa}
                    className={cn(
                      'relative block aspect-square w-full overflow-hidden rounded-xl ring-2 transition',
                      ativa ? 'ring-zinc-900 dark:ring-white' : 'ring-transparent',
                    )}
                  >
                    <img
                      src={urlFoto(f.caminho_miniatura)}
                      alt={f.rotulo}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-left text-[10px] leading-tight text-white">
                      {f.rotulo}
                    </span>
                    {ativa && (
                      <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                        <Check className="size-4" />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            icone={<Images className="size-4" />}
            disabled={!escolhidas.size}
            carregando={salvando}
            onClick={confirmar}
          >
            Usar {escolhidas.size ? `(${escolhidas.size})` : ''}
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
