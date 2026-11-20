import {
  Boxes,
  ClipboardCheck,
  History,
  Moon,
  Package,
  Printer,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth, usePermissoes } from '../auth/auth'
import { cn, iniciais } from '../lib/util'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-10 shrink-0', className)} aria-hidden>
      <rect width="40" height="40" rx="10" className="fill-zinc-900 dark:fill-white" />
      <g className="fill-white dark:fill-zinc-900">
        <rect x="9" y="8" width="4" height="3" rx="1" />
        <rect x="15" y="8" width="4" height="3" rx="1" />
        <rect x="21" y="8" width="4" height="3" rx="1" />
        <rect x="27" y="8" width="4" height="3" rx="1" />
        <rect x="7" y="11.5" width="26" height="6" rx="1.5" />
        <rect x="8" y="19" width="24" height="13" rx="1.5" />
      </g>
      <rect x="17" y="22" width="6" height="2.5" rx="1" className="fill-zinc-900 dark:fill-white" />
    </svg>
  )
}

type Tema = 'claro' | 'escuro' | 'sistema'

export function aplicarTema(tema: Tema) {
  try {
    localStorage.setItem('tema', tema)
  } catch {
    /* modo privado */
  }
  const escuro = tema === 'escuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', escuro)
}

export function temaAtual(): Tema {
  try {
    const t = localStorage.getItem('tema')
    if (t === 'claro' || t === 'escuro' || t === 'sistema') return t
  } catch {
    /* modo privado */
  }
  return 'sistema'
}

function BotaoTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  return (
    <button
      type="button"
      onClick={() => {
        aplicarTema(escuro ? 'claro' : 'escuro')
        setEscuro(!escuro)
      }}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {escuro ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  ativoEm?: string[]
}

export function Layout() {
  const { perfil } = useAuth()
  const { podeEditar, ehAdmin } = usePermissoes()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const itens: ItemNav[] = [
    { para: '/', rotulo: 'Caixas', icone: Boxes, ativoEm: ['/tipo/', '/caixas/'] },
    { para: '/materiais', rotulo: 'Materiais', icone: Package },
    { para: '/conferencia', rotulo: 'Conferência', icone: ClipboardCheck },
    { para: '/imprimir', rotulo: 'Imprimir', icone: Printer },
    ...(podeEditar ? [{ para: '/historico', rotulo: 'Histórico', icone: History }] : []),
    ...(ehAdmin ? [{ para: '/usuarios', rotulo: 'Usuários', icone: Users }] : []),
  ]

  const primeiroNome = (perfil?.nome ?? '').split(' ')[0]

  return (
    <div className="min-h-dvh">
      <header className="nao-imprimir sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-100/85 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-xl font-bold uppercase tracking-wide">Inventário de caixas</div>
              <div className="rotulo truncate">Consulta de materiais</div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <BotaoTema />
            <Link
              to="/conta"
              title="Minha conta"
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1 transition hover:bg-zinc-200/70 sm:pr-3 dark:hover:bg-zinc-800"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">
                {iniciais(perfil?.nome)}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{primeiroNome}</span>
            </Link>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-1.5">
            {itens.map((item) => {
              const extra = item.ativoEm?.some((p) => pathname.startsWith(p)) ?? false
              return (
                <li key={item.para}>
                  <NavLink
                    to={item.para}
                    end={item.para === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold uppercase tracking-wider transition',
                        isActive || extra
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-800',
                      )
                    }
                  >
                    <item.icone className="size-4" />
                    {item.rotulo}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-5">
        <Outlet />
      </main>
    </div>
  )
}
