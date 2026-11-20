import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Trava de saída: enquanto `ativo`, fechar a aba avisa pelo navegador e clicar em qualquer link
 * interno do app pede confirmação antes de trocar de página.
 * O botão "voltar" (e o gesto de voltar do iPad/iPhone) também é interceptado: enquanto a trava está ativa
 * fica uma entrada extra no histórico, e voltar só desfaz essa entrada depois da resposta.
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
        if (sair) navigate(url.pathname + url.search + url.hash, { replace: true })
      })
    }
    // Entrada extra no histórico: o "voltar" cai nela em vez de sair da página.
    const estadoAtual = window.history.state
    window.history.pushState(estadoAtual, '', window.location.href)
    let ativoAinda = true
    let perguntando = false
    const aoVoltar = () => {
      if (!ativoAinda || perguntando) return
      perguntando = true
      void confirmar.current().then((sair) => {
        perguntando = false
        if (sair) {
          ativoAinda = false
          window.removeEventListener('popstate', aoVoltar)
          window.history.back()
        } else {
          window.history.pushState(estadoAtual, '', window.location.href)
        }
      })
    }
    window.addEventListener('popstate', aoVoltar)
    window.addEventListener('beforeunload', antesDeFechar)
    document.addEventListener('click', aoClicar, true)
    return () => {
      ativoAinda = false
      window.removeEventListener('popstate', aoVoltar)
      window.removeEventListener('beforeunload', antesDeFechar)
      document.removeEventListener('click', aoClicar, true)
    }
  }, [ativo, navigate])
}
