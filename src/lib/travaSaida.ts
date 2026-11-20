import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Trava de saída: enquanto `ativo`, fechar a aba avisa pelo navegador e clicar em qualquer link
 * interno do app pede confirmação antes de trocar de página.
 * (O botão "voltar" do navegador não dá para interceptar neste tipo de roteador.)
 */
export function useTravaSaida(ativo: boolean, confirmarSaida: () => Promise<boolean>) {
  const navigate = useNavigate()
  const confirmar = useRef(confirmarSaida)
  useEffect(() => {
    confirmar.current = confirmarSaida
  })

  useEffect(() => {
    if (!ativo) return
    const antesDeFechar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      void confirmar.current().then((sair) => {
        if (sair) navigate(url.pathname + url.search + url.hash)
      })
    }
    window.addEventListener('beforeunload', antesDeFechar)
    document.addEventListener('click', aoClicar, true)
    return () => {
      window.removeEventListener('beforeunload', antesDeFechar)
      document.removeEventListener('click', aoClicar, true)
    }
  }, [ativo, navigate])
}
