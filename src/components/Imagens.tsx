import { useQueryClient } from '@tanstack/react-query'
import { Camera, LoaderCircle, Package, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { definirCapa, enviarFotos, excluirFoto, type DonoFoto } from '../lib/api'
import type { Grupo } from '../lib/grupos'
import { srcModelo } from '../lib/modelos'
import { urlFoto } from '../lib/supabase'
import type { Foto } from '../lib/tipos'
import { cn, mensagemErro } from '../lib/util'
import { useAvisos } from './avisos'
import { Modal } from './Modal'
import { Botao } from './ui'

export function SemFoto({ compacto }: { compacto?: boolean }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
      <Package className={compacto ? 'size-5' : 'size-8'} strokeWidth={1.5} />
      {!compacto && <span className="rotulo text-[10px]">Sem foto</span>}
    </div>
  )
}

export function Imagem({
  src,
  alt = '',
  className,
  compacto,
}: {
  src: string | null | undefined
  alt?: string
  className?: string
  compacto?: boolean
}) {
  const [erro, setErro] = useState(false)
  useEffect(() => setErro(false), [src])
  if (!src || erro) return <SemFoto compacto={compacto} />
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setErro(true)}
      className={cn('size-full object-cover', className)}
    />
  )
}

/** Foto do cartão do tipo: foto da caixa → foto do modelo → mosaico dos materiais. */
export function ImagemGrupo({ grupo }: { grupo: Grupo }) {
  if (grupo.imagem) return <Imagem src={grupo.imagem.src} alt={grupo.nome} />
  if (grupo.fotosMateriais.length) {
    const fotos = grupo.fotosMateriais
    return (
      <div className={cn('grid size-full gap-px bg-zinc-200 dark:bg-zinc-700', fotos.length > 1 && 'grid-cols-2')}>
        {fotos.map((f) => (
          <Imagem key={f} src={urlFoto(f)} compacto />
        ))}
      </div>
    )
  }
  return <SemFoto />
}

export function Miniatura({ caminho, className }: { caminho: string | null | undefined; className?: string }) {
  return (
    <div className={cn('size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800', className)}>
      <Imagem src={caminho ? urlFoto(caminho) : null} compacto />
    </div>
  )
}

/** Galeria com envio de fotos (câmera ou biblioteca), capa e exclusão. */
export function Galeria({
  fotos,
  dono,
  podeEditar,
  modelo,
  alt,
}: {
  fotos: Foto[]
  dono: DonoFoto
  podeEditar: boolean
  modelo?: string | null
  alt: string
}) {
  const ordenadas = useMemo(
    () => [...fotos].sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em)),
    [fotos],
  )
  const [indice, setIndice] = useState(0)
  const [ampliada, setAmpliada] = useState(false)
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const { avisar, confirmar } = useAvisos()
  const qc = useQueryClient()

  const atual = ordenadas[Math.min(indice, ordenadas.length - 1)]
  const srcPrincipal = atual ? urlFoto(atual.caminho) : modelo ? srcModelo(modelo, true) : null

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!arquivos.length) return
    setEnviando({ feitos: 0, total: arquivos.length })
    try {
      await enviarFotos(arquivos, dono, (feitos) => setEnviando({ feitos, total: arquivos.length }))
      await qc.invalidateQueries()
      avisar(arquivos.length === 1 ? 'Foto adicionada.' : `${arquivos.length} fotos adicionadas.`)
    } catch (erro) {
      await qc.invalidateQueries()
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setEnviando(null)
    }
  }

  async function capa() {
    if (!atual) return
    setOcupado(true)
    try {
      await definirCapa(atual, ordenadas)
      await qc.invalidateQueries()
      setIndice(0)
      avisar('Foto definida como capa.')
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setOcupado(false)
    }
  }

  async function excluir() {
    if (!atual) return
    const ok = await confirmar({
      titulo: 'Excluir foto?',
      mensagem: 'A foto será apagada definitivamente.',
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return
    setOcupado(true)
    try {
      await excluirFoto(atual)
      await qc.invalidateQueries()
      setIndice(0)
      avisar('Foto excluída.')
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        {srcPrincipal ? (
          <button type="button" className="size-full" onClick={() => setAmpliada(true)} aria-label="Ampliar foto">
            <Imagem src={srcPrincipal} alt={alt} />
          </button>
        ) : (
          <SemFoto />
        )}
        {!atual && modelo && (
          <span className="rotulo absolute bottom-3 left-3 rounded-lg bg-white/90 px-2 py-1 text-zinc-700 backdrop-blur dark:bg-zinc-900/80 dark:text-zinc-200">
            Foto do modelo
          </span>
        )}
        {atual && podeEditar && (
          <div className="absolute right-3 top-3 flex gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={capa}
                disabled={ocupado}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-800 shadow backdrop-blur hover:bg-white dark:bg-zinc-900/85 dark:text-zinc-100"
              >
                <Star className="size-4" /> Capa
              </button>
            )}
            <button
              type="button"
              onClick={excluir}
              disabled={ocupado}
              aria-label="Excluir foto"
              className="inline-flex size-9 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow backdrop-blur hover:bg-white dark:bg-zinc-900/85"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
        {enviando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
            <LoaderCircle className="size-7 animate-spin" />
            <span className="text-sm font-semibold">
              Enviando {enviando.feitos + 1 > enviando.total ? enviando.total : enviando.feitos + 1} de {enviando.total}…
            </span>
          </div>
        )}
      </div>

      {(ordenadas.length > 1 || podeEditar) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ordenadas.length > 1 &&
            ordenadas.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Foto ${i + 1}`}
                className={cn(
                  'size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition',
                  i === indice ? 'ring-zinc-900 dark:ring-white' : 'ring-transparent opacity-75 hover:opacity-100',
                )}
              >
                <Imagem src={urlFoto(f.caminho_miniatura)} compacto />
              </button>
            ))}
          {podeEditar && (
            <>
              <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={aoEscolher} />
              <Botao
                icone={<Camera className="size-4" />}
                onClick={() => entrada.current?.click()}
                disabled={!!enviando}
                className={ordenadas.length > 1 ? 'h-16' : ''}
              >
                {ordenadas.length ? 'Mais fotos' : 'Adicionar foto'}
              </Botao>
            </>
          )}
        </div>
      )}

      <Modal aberto={ampliada} aoFechar={() => setAmpliada(false)} titulo={alt} largura="max-w-5xl">
        {srcPrincipal && <img src={srcPrincipal} alt={alt} className="mx-auto max-h-[72dvh] w-auto rounded-xl" />}
      </Modal>
    </div>
  )
}
