import { Box, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Props = { src: string; alt: string; poster?: string | null; interativo?: boolean }

/** Visualizador 3D (gira devagar sozinho; onde é interativo, dá para arrastar). A biblioteca só é baixada quando aparece. */
export function Modelo3D({ src, alt, poster, interativo = true }: Props) {
  const [pronto, setPronto] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let ativo = true
    import('@google/model-viewer')
      .then(() => ativo && setPronto(true))
      .catch(() => ativo && setFalhou(true))
    return () => {
      ativo = false
    }
  }, [])

  // Eventos do <model-viewer> ligados direto no elemento (os de React não chegam em web components).
  useEffect(() => {
    const el = ref.current
    if (!pronto || !el) return
    setCarregado(false)
    const aoCarregar = () => setCarregado(true)
    // Só desiste se o arquivo não carregar; perda momentânea do WebGL (comum no iPhone) se recupera sozinha.
    const aoFalhar = (e: Event) => {
      if ((e as CustomEvent<{ type?: string }>).detail?.type === 'loadfailure') setFalhou(true)
    }
    el.addEventListener('load', aoCarregar)
    el.addEventListener('error', aoFalhar)
    if ((el as HTMLElement & { loaded?: boolean }).loaded) setCarregado(true)
    return () => {
      el.removeEventListener('load', aoCarregar)
      el.removeEventListener('error', aoFalhar)
    }
  }, [pronto, src])

  if (falhou) {
    return poster ? (
      <img src={poster} alt={alt} className="size-full object-cover" />
    ) : (
      <div className="flex size-full items-center justify-center text-zinc-400">
        <Box className="size-8" strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <div className="relative size-full">
      {pronto && (
        <model-viewer
          ref={ref}
          src={src}
          alt={alt}
          camera-controls={interativo || undefined}
          disable-zoom
          disable-pan
          auto-rotate
          auto-rotate-delay="1500"
          rotation-per-second="7deg"
          touch-action="pan-y"
          interaction-prompt="none"
          shadow-intensity="0.9"
          shadow-softness="1"
          exposure="1"
          environment-image="neutral"
          camera-orbit="30deg 68deg auto"
          min-camera-orbit="auto 55deg auto"
          max-camera-orbit="auto 78deg auto"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            outline: 'none',
            pointerEvents: interativo ? 'auto' : 'none',
            opacity: carregado ? 1 : 0,
            transition: 'opacity 250ms',
          }}
        />
      )}
      {!carregado && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-zinc-400" />
        </div>
      )}
    </div>
  )
}
