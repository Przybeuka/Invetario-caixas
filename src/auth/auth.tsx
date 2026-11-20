import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Papel, Perfil } from '../lib/tipos'

interface ContextoAuth {
  sessao: Session | null
  perfil: Perfil | null
  carregando: boolean
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

const Ctx = createContext<ContextoAuth | null>(null)

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const buscarPerfil = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('perfis').select('*').eq('id', uid).maybeSingle()
    setPerfil((data as Perfil | null) ?? null)
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao)
      if (evento === 'PASSWORD_RECOVERY') navigate('/redefinir-senha')
      if (evento === 'SIGNED_OUT') {
        setPerfil(null)
        void qc.invalidateQueries()
        setCarregando(false)
        return
      }
      if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN' || evento === 'USER_UPDATED') {
        // Não chamar o Supabase direto dentro deste callback (pode travar a sessão).
        setTimeout(() => {
          if (evento === 'SIGNED_IN') void qc.invalidateQueries()
          void buscarPerfil(novaSessao?.user.id).finally(() => setCarregando(false))
        }, 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [buscarPerfil, navigate, qc])

  const recarregarPerfil = useCallback(() => buscarPerfil(sessao?.user.id), [buscarPerfil, sessao])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    navigate('/')
  }, [navigate])

  const valor = useMemo(
    () => ({ sessao, perfil, carregando, recarregarPerfil, sair }),
    [sessao, perfil, carregando, recarregarPerfil, sair],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): ContextoAuth {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>')
  return ctx
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  pendente: 'Sem acesso',
  conferente: 'Conferente',
  editor: 'Editor',
  admin: 'Administrador',
}

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  pendente: 'Aguardando aprovação. Não vê nada.',
  conferente: 'Consulta caixas e materiais e registra conferências.',
  editor: 'Também cadastra e edita caixas, materiais e fotos.',
  admin: 'Também exclui caixas e materiais, aprova usuários e muda configurações.',
}

export function usePermissoes() {
  const { perfil } = useAuth()
  const papel: Papel = perfil?.papel ?? 'pendente'
  return {
    papel,
    logado: !!perfil,
    podeConferir: papel !== 'pendente',
    podeEditar: papel === 'editor' || papel === 'admin',
    ehAdmin: papel === 'admin',
  }
}
