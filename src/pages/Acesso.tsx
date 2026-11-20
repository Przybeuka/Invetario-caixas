import { Eye, EyeOff, Hourglass, LogOut, MailCheck, RefreshCw } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { Logo } from '../components/Layout'
import { Botao, Campo, Segmentado } from '../components/ui'
import { MODELOS, srcModelo } from '../lib/modelos'
import { LOGIN_GOOGLE, supabase } from '../lib/supabase'
import { mensagemErro } from '../lib/util'

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <div className="absolute inset-0 grid grid-cols-3 gap-1 opacity-70">
          {MODELOS.map((m) => (
            <img key={m.id} src={srcModelo(m.id)} alt="" className="size-full object-contain p-6" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <h1 className="font-display text-6xl font-bold uppercase leading-none tracking-wide">
            Inventário
            <br />
            de caixas
          </h1>
          <p className="mt-4 max-w-md text-lg text-zinc-300">
            O que tem em cada caixa, onde está e quando foi conferida.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm">
          <Link to="/" className="rotulo mb-6 inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white">
            ← Voltar para a consulta
          </Link>
          <Link to="/" title="Ir para a home" className="mb-8 flex items-center gap-3">
            <Logo className="size-12" />
            <div className="leading-tight">
              <div className="font-display text-2xl font-bold uppercase tracking-wide">Inventário de caixas</div>
              <div className="rotulo">Consulta de materiais</div>
            </div>
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}

function CampoSenha({
  valor,
  aoMudar,
  rotulo = 'Senha',
  novo,
}: {
  valor: string
  aoMudar: (v: string) => void
  rotulo?: string
  novo?: boolean
}) {
  const [ver, setVer] = useState(false)
  return (
    <Campo rotulo={rotulo}>
      <div className="relative">
        <input
          className="campo pr-12"
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          autoComplete={novo ? 'new-password' : 'current-password'}
          minLength={6}
          required
        />
        <button
          type="button"
          onClick={() => setVer(!ver)}
          aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Campo>
  )
}

type Modo = 'entrar' | 'criar' | 'recuperar'

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setAviso('')
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (error) throw error
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setAviso(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail, confirme e depois entre aqui.`)
          setModo('entrar')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        })
        if (error) throw error
        setAviso('Se o e-mail tiver conta, você vai receber um link para criar uma nova senha.')
        setModo('entrar')
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function entrarGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) setErro(mensagemErro(error))
  }

  return (
    <Moldura>
      {modo !== 'recuperar' && (
        <Segmentado
          className="mb-6 w-full"
          valor={modo}
          aoMudar={(v) => {
            setModo(v)
            setErro('')
          }}
          opcoes={[
            { valor: 'entrar', rotulo: 'Entrar' },
            { valor: 'criar', rotulo: 'Criar conta' },
          ]}
        />
      )}
      {modo === 'recuperar' && (
        <div className="mb-6">
          <h2 className="font-display text-3xl font-bold">Recuperar senha</h2>
          <p className="mt-1 text-sm text-zinc-500">Informe seu e-mail para receber o link.</p>
        </div>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-4">
        {modo === 'criar' && (
          <Campo rotulo="Nome de guerra ou nome completo">
            <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
          </Campo>
        )}
        <Campo rotulo="E-mail">
          <input
            className="campo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </Campo>
        {modo !== 'recuperar' && <CampoSenha valor={senha} aoMudar={setSenha} novo={modo === 'criar'} />}

        {erro && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            {aviso}
          </p>
        )}

        <Botao variante="primario" tamanho="lg" type="submit" carregando={enviando} className="mt-1 w-full">
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </Botao>

        {modo === 'entrar' && (
          <button
            type="button"
            onClick={() => {
              setModo('recuperar')
              setErro('')
            }}
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-white"
          >
            Esqueci minha senha
          </button>
        )}
        {modo === 'recuperar' && (
          <button type="button" onClick={() => setModo('entrar')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Voltar para o login
          </button>
        )}
        {modo === 'criar' && (
          <p className="text-xs leading-relaxed text-zinc-500">
            Depois de criar a conta, um administrador precisa liberar seu acesso.
          </p>
        )}
      </form>

      {LOGIN_GOOGLE && modo !== 'recuperar' && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="rotulo">ou</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <Botao tamanho="lg" className="w-full" onClick={entrarGoogle}>
            Entrar com Google
          </Botao>
        </>
      )}
    </Moldura>
  )
}

export function Pendente() {
  const { perfil, sessao, recarregarPerfil, sair } = useAuth()
  const [verificando, setVerificando] = useState(false)
  return (
    <Moldura>
      <div className="flex flex-col gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Hourglass className="size-7" />
        </span>
        <h2 className="font-display text-3xl font-bold">
          {perfil ? 'Aguardando liberação' : 'Não foi possível carregar seu perfil'}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-300">
          {perfil
            ? 'Sua conta foi criada. Peça a um administrador para liberar seu acesso em Usuários.'
            : 'Verifique a internet e tente de novo.'}
        </p>
        <div className="cartao p-4 text-sm">
          <div className="font-semibold">{perfil?.nome || 'Usuário'}</div>
          <div className="text-zinc-500">{perfil?.email ?? sessao?.user.email}</div>
        </div>
        <div className="flex gap-2">
          <Botao
            variante="primario"
            icone={<RefreshCw className="size-4" />}
            carregando={verificando}
            onClick={async () => {
              setVerificando(true)
              await recarregarPerfil()
              setVerificando(false)
            }}
          >
            Verificar de novo
          </Botao>
          <Botao icone={<LogOut className="size-4" />} onClick={sair}>
            Sair
          </Botao>
        </div>
      </div>
    </Moldura>
  )
}

export function RedefinirSenha() {
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) setErro(mensagemErro(error))
    else navigate('/', { replace: true })
  }

  return (
    <Moldura>
      {sessao ? (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-bold">Nova senha</h2>
          <CampoSenha valor={senha} aoMudar={setSenha} rotulo="Nova senha (mín. 6 caracteres)" novo />
          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{erro}</p>}
          <Botao variante="primario" tamanho="lg" type="submit" carregando={enviando}>
            Salvar senha
          </Botao>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-bold">Link inválido ou expirado</h2>
          <p className="text-zinc-600 dark:text-zinc-300">Peça um novo link em “Esqueci minha senha”.</p>
          <Link to="/" className="font-semibold underline underline-offset-4">
            Ir para o login
          </Link>
        </div>
      )}
    </Moldura>
  )
}
