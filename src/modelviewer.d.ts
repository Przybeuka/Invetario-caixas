import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        alt?: string
        poster?: string
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'auto-rotate-delay'?: string
        'rotation-per-second'?: string
        'touch-action'?: string
        'interaction-prompt'?: string
        'shadow-intensity'?: string
        'shadow-softness'?: string
        exposure?: string
        'environment-image'?: string
        'camera-orbit'?: string
        onLoad?: () => void
        onError?: () => void
      }
    }
  }
}
