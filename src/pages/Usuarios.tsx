import { ImageUp, UserCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { DESCRICAO_PAPEL, ROTULO_PAPEL, useAuth, usePermissoes } from '../auth/auth'
import { Botao, Carregando, classeBotao, ErroCarga, Secao } from '../components/ui'
import { atualizarPerfil, useAcao, usePerfis } from '../lib/api'
import type { Papel, Perfil } from '../lib/tipos'
import { cn, formatarData, iniciais } from '../lib/util'

const PAPEIS: Papel[] = ['conferente', 'editor', 'admin', 'pendente']

function Avatar({ nome }: { nome: string }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {iniciais(nome)}
    </span>
  )
}

function LinhaUsuario({ p, eu }: { p: Perfil; eu: boolean }) {
  const { recarregarPerfil } = useAuth()
  const mudar = useAcao(
    async (papel: Papel) => {
      const n = await atualizarPerfil(p.id, { papel })
      if (eu) await recarregarPerfil()
      return n
    },
    (_r, papel) => `${p.nome || p.email}: ${ROTULO_PAPEL[papel]}.`,
  )
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar nome={p.nome} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {p.nome || 'Sem nome'} {eu && <span className="rotulo ml-1">você</span>}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {p.email} · desde {formatarData(p.criado_em)}
        </div>
      </div>
      <select
        className="campo h-11 w-auto py-1"
        value={p.papel}
        disabled={mudar.isPending}
        onChange={(e) => mudar.mutate(e.target.value as Papel)}
        aria-label={`Nível de acesso de ${p.nome}`}
      >
        {PAPEIS.map((papel) => (
          <option key={papel} value={papel}>
            {ROTULO_PAPEL[papel]}
          </option>
        ))}
      </select>
    </li>
  )
}

function LinhaPendente({ p }: { p: Perfil }) {
  const mudar = useAcao(
    (papel: Papel) => atualizarPerfil(p.id, { papel }),
    (_r, papel) => `Acesso liberado: ${p.nome || p.email} (${ROTULO_PAPEL[papel]}).`,
  )
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar nome={p.nome} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.nome || 'Sem nome'}</div>
        <div className="truncate text-xs text-zinc-500">
          {p.email} · pediu em {formatarData(p.criado_em)}
        </div>
      </div>
      <div className="flex gap-2">
        <Botao tamanho="sm" carregando={mudar.isPending} onClick={() => mudar.mutate('conferente')}>
          Conferente
        </Botao>
        <Botao tamanho="sm" variante="primario" carregando={mudar.isPending} onClick={() => mudar.mutate('editor')}>
          Editor
        </Botao>
      </div>
    </li>
  )
}

export function Usuarios() {
  const { ehAdmin } = usePermissoes()
  const { perfil } = useAuth()
  const { data: perfis = [], isLoading, error } = usePerfis(ehAdmin)

  if (!ehAdmin) return <Navigate to="/" replace />
  if (error) return <ErroCarga erro={error} />
  if (isLoading) return <Carregando />

  const pendentes = perfis.filter((p) => p.papel === 'pendente')
  const ativos = perfis.filter((p) => p.papel !== 'pendente')

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold">Usuários</h1>
          <p className="text-sm text-zinc-500">Quem cria conta entra como “conferente”. Promova a editor ou admin quando precisar.</p>
        </div>
        <Link to="/importar-fotos" className={classeBotao('secundario')}>
          <ImageUp className="size-4" /> Importar fotos
        </Link>
      </div>

      {pendentes.length > 0 && (
        <Secao
          titulo={
            <span className="inline-flex items-center gap-2">
              <UserCheck className="size-6" /> Aguardando liberação{' '}
              <span className="rounded-full bg-amber-500 px-2 text-base text-white">{pendentes.length}</span>
            </span>
          }
        >
          <ul className="cartao divide-y divide-zinc-100 border-amber-300 px-4 dark:divide-zinc-800 dark:border-amber-900">
            {pendentes.map((p) => (
              <LinhaPendente key={p.id} p={p} />
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Com acesso">
        <ul className="cartao divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
          {ativos.map((p) => (
            <LinhaUsuario key={p.id} p={p} eu={p.id === perfil?.id} />
          ))}
        </ul>
      </Secao>

      <Secao titulo="Níveis de acesso">
        <dl className="grid gap-2 sm:grid-cols-2">
          {(['conferente', 'editor', 'admin', 'pendente'] as Papel[]).map((papel) => (
            <div key={papel} className={cn('cartao p-4')}>
              <dt className="font-semibold">{ROTULO_PAPEL[papel]}</dt>
              <dd className="text-sm text-zinc-500">{DESCRICAO_PAPEL[papel]}</dd>
            </div>
          ))}
        </dl>
      </Secao>
    </div>
  )
}
