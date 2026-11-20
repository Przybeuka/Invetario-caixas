import { Box, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = { src: string; alt: string; poster?: string | null }

/** Visualizador 3D interativo (arraste para girar). A biblioteca só é baixada quando o modelo é aberto. */
export function Modelo3D({ src, alt, poster }: Props) {
  const [pronto, setPronto] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    import('@google/model-viewer')
      .then(() => ativo && setPronto(true))
      .catch(() => ativo && setFalhou(true))
    return () => {
      ativo = false
    }
  }, [])

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
      {!carregado && poster && <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
      {pronto && (
        <model-viewer
          src={src}
          alt={alt}
          camera-controls
          auto-rotate
          auto-rotate-delay="2500"
          rotation-per-second="18deg"
          touch-action="pan-y"
          interaction-prompt="none"
          shadow-intensity="0.9"
          shadow-softness="1"
          exposure="1"
          environment-image="neutral"
          camera-orbit="35deg 70deg auto"
          onLoad={() => setCarregado(true)}
          onError={() => setFalhou(true)}
          style={{ width: '100%', height: '100%', background: 'transparent', outline: 'none' }}
        />
      )}
      {!carregado && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-7 animate-spin text-zinc-500" />
        </div>
      )}
    </div>
  )
}
