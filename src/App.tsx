import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth, usePermissoes } from './auth/auth'
import { Layout, Logo } from './components/Layout'
import { Carregando, classeBotao, Vazio } from './components/ui'
import { Login, RedefinirSenha } from './pages/Acesso'
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

type Nivel = 'login' | 'conferente' | 'editor' | 'admin'

/** Páginas que exigem login: sem login vai para "Entrar"; sem nível suficiente mostra aviso. */
function Exige({ nivel, children }: { nivel: Nivel; children: ReactNode }) {
  const { sessao } = useAuth()
  const { podeConferir, podeEditar, ehAdmin } = usePermissoes()
  const { pathname, search } = useLocation()
  if (!sessao) return <Navigate to={`/entrar?voltar=${encodeURIComponent(pathname + search)}`} replace />
  const ok =
    nivel === 'login' ||
    (nivel === 'conferente' && podeConferir) ||
    (nivel === 'editor' && podeEditar) ||
    (nivel === 'admin' && ehAdmin)
  if (!ok)
    return (
      <Vazio
        titulo="Sem permissão"
        texto={
          podeConferir
            ? 'Seu nível de acesso não permite abrir esta página.'
            : 'Sua conta ainda aguarda liberação de um administrador.'
        }
        acao={
          <Link to="/" className={classeBotao('primario')}>
            Ir para caixas
          </Link>
        }
      />
    )
  return <Sob>{children}</Sob>
}

function Entrar() {
  const { sessao } = useAuth()
  const [params] = useSearchParams()
  if (sessao) return <Navigate to={params.get('voltar') || '/'} replace />
  return <Login />
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
  const { carregando } = useAuth()
  const { pathname } = useLocation()

  if (pathname === '/redefinir-senha') return <RedefinirSenha />
  if (carregando) return <Abertura />

  return (
    <Routes>
      <Route path="entrar" element={<Entrar />} />
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="tipo/:nome" element={<Tipo />} />
        <Route path="caixas/:id" element={<CaixaPagina />} />
        <Route path="materiais" element={<Sob><Materiais /></Sob>} />
        <Route path="materiais/:id" element={<Sob><MaterialPagina /></Sob>} />
        <Route path="caixas/:id/conferir" element={<Exige nivel="conferente"><Conferir /></Exige>} />
        <Route path="conferencia" element={<Exige nivel="conferente"><Conferencias /></Exige>} />
        <Route path="imprimir" element={<Exige nivel="conferente"><Imprimir /></Exige>} />
        <Route path="historico" element={<Exige nivel="editor"><Historico /></Exige>} />
        <Route path="usuarios" element={<Exige nivel="admin"><Usuarios /></Exige>} />
        <Route path="conta" element={<Exige nivel="login"><Conta /></Exige>} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  )
}
