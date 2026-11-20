import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/auth'
import { Layout, Logo } from './components/Layout'
import { Carregando, classeBotao, Vazio } from './components/ui'
import { Login, Pendente, RedefinirSenha } from './pages/Acesso'
import { CaixaPagina } from './pages/Caixa'
import { Conferir } from './pages/Conferir'
import { Inicio } from './pages/Inicio'
import { Tipo } from './pages/Tipo'

// Páginas menos usadas carregam sob demanda (abre mais rápido no iPad).
const Materiais = lazy(() => import('./pages/Materiais').then((m) => ({ default: m.Materiais })))
const MaterialPagina = lazy(() => import('./pages/Material').then((m) => ({ default: m.MaterialPagina })))
const Conferencias = lazy(() => import('./pages/Conferencias').then((m) => ({ default: m.Conferencias })))
const Imprimir = lazy(() => import('./pages/Imprimir').then((m) => ({ default: m.Imprimir })))
const Historico = lazy(() => import('./pages/Historico').then((m) => ({ default: m.Historico })))
const Usuarios = lazy(() => import('./pages/Usuarios').then((m) => ({ default: m.Usuarios })))
const Conta = lazy(() => import('./pages/Conta').then((m) => ({ default: m.Conta })))

function Sob({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>
}

function Abertura() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo className="size-14 animate-pulse" />
      <span className="rotulo">Inventário de caixas</span>
    </div>
  )
}

function NaoEncontrado() {
  return (
    <Vazio
      titulo="Página não encontrada"
      acao={
        <Link to="/" className={classeBotao('primario')}>
          Ir para caixas
        </Link>
      }
    />
  )
}

export default function App() {
  const { sessao, perfil, carregando } = useAuth()
  const { pathname } = useLocation()

  if (pathname === '/redefinir-senha') return <RedefinirSenha />
  if (carregando) return <Abertura />
  if (!sessao) return <Login />
  if (!perfil || perfil.papel === 'pendente') return <Pendente />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="tipo/:nome" element={<Tipo />} />
        <Route path="caixas/:id" element={<CaixaPagina />} />
        <Route path="caixas/:id/conferir" element={<Conferir />} />
        <Route path="materiais" element={<Sob><Materiais /></Sob>} />
        <Route path="materiais/:id" element={<Sob><MaterialPagina /></Sob>} />
        <Route path="conferencia" element={<Sob><Conferencias /></Sob>} />
        <Route path="imprimir" element={<Sob><Imprimir /></Sob>} />
        <Route path="historico" element={<Sob><Historico /></Sob>} />
        <Route path="usuarios" element={<Sob><Usuarios /></Sob>} />
        <Route path="conta" element={<Sob><Conta /></Sob>} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  )
}
