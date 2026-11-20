import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { cn } from '../lib/util'

/** QR code em SVG (nítido na impressão). */
export function QR({ texto, className }: { texto: string; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let ativo = true
    QRCode.toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((s) => ativo && setSvg(s))
      .catch(() => ativo && setSvg(''))
    return () => {
      ativo = false
    }
  }, [texto])
  return (
    <div
      className={cn('aspect-square [&>svg]:size-full', className)}
      aria-label="QR code"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
