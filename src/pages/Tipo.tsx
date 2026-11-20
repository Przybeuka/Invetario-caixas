import { ArrowLeft, ChevronRight, Copy, MapPin, Pencil, Plus, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePermissoes } from '../auth/auth'
import { CopiarConteudo } from '../components/CopiarConteudo'
import { FormCaixa } from '../components/FormCaixa'
import { FormTipo } from '../components/FormTipo'
import { ImagemGrupo, Imagem } from '../components/Imagens'
import { SeloEstado, StatusIcone } from '../components/Status'
import { Botao, Carregando, classeBotao, Contador, RotuloCor, Vazio } from '../components/ui'
import { useCaixas, useValidade } from '../lib/api'
import { agrupar, estadoDaCaixa, imagemDaCaixa, resumoMateriais, resumoTamanho } from '../lib/grupos'
import { cn, normalizar, plural, ROTULO_TAMANHO } from '../lib/util'

export function Tipo() {
  const { nome = '' } = useParams()
  const { podeEditar } = usePermissoes()
  const { data: caixas = [], isLoading } = useCaixas()
  const validade = useValidade()
  const [novaAberta, setNovaAberta] = useState(false)
  const [editarAberto, setEditarAberto] = useState(false)
  const [copiarAberto, setCopiarAberto] = useState(false)

  const grupo = useMemo(
    () => agrupar(caixas, validade).find((g) => g.chave === normalizar(nome)),
    [caixas, validade, nome],
  )

  if (isLoading) return <Carregando />
  if (!grupo)
    return (
      <Vazio
        titulo="Tipo não encontrado"
        texto="Ele pode ter sido renomeado ou excluído."
        acao={
          <Link to="/" className={classeBotao('primario')}>
            Voltar para caixas
          </Link>
        }
      />
    )

  const modeloConteudo = grupo.caixas.find((c) => c.qtd_itens > 0)
  const ref = grupo.caixas[0]
  const detalhes = [resumoMateriais(grupo.caixas), resumoTamanho(grupo.caixas)].filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="rotulo inline-flex items-center gap-1.5 self-start hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Caixas
      </Link>

      <header className="cartao flex flex-col gap-5 overflow-hidden p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl sm:w-56">
          <ImagemGrupo grupo={grupo} />
          <StatusIcone estado={grupo.estado} className="absolute left-2 top-2" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">{grupo.nome}</h1>
            <Contador valor={grupo.caixas.length} className="h-11 min-w-11 text-xl" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {grupo.cores.map((c) => (
              <RotuloCor key={c.nome} nome={c.nome} hex={c.hex} />
            ))}
            {detalhes.map((d) => (
              <span key={d} className="rotulo">
                {d}
              </span>
            ))}
            <span className="rotulo">
              {grupo.conferidas}/{grupo.caixas.length} conferidas
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {podeEditar && (
              <>
                <Botao variante="primario" icone={<Plus className="size-4" />} onClick={() => setNovaAberta(true)}>
                  Caixa deste tipo
                </Botao>
                <Botao icone={<Pencil className="size-4" />} onClick={() => setEditarAberto(true)}>
                  Editar tipo
                </Botao>
                {modeloConteudo && grupo.caixas.length > 1 && (
                  <Botao icone={<Copy className="size-4" />} onClick={() => setCopiarAberto(true)}>
                    Igualar conteúdo
                  </Botao>
                )}
              </>
            )}
            <Link to={`/imprimir?tipo=${encodeURIComponent(grupo.nome)}`} className={classeBotao('secundario')}>
              <Printer className="size-4" /> Adesivos
            </Link>
          </div>
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {grupo.caixas.map((c) => {
          const estado = estadoDaCaixa(c, validade)
          const img = imagemDaCaixa(c)
          return (
            <li key={c.id}>
              <Link
                to={`/caixas/${c.id}`}
                className="cartao group flex items-center gap-3 overflow-hidden p-2 pr-3 transition hover:shadow-md sm:gap-4"
              >
                <span aria-hidden className="h-14 w-1.5 shrink-0 rounded-full" style={{ background: c.cor_hex ?? '#a1a1aa' }} />
                <span className="w-16 shrink-0 text-center font-display text-4xl font-bold tabular-nums leading-none sm:w-20 sm:text-5xl">
                  {c.numero}
                </span>
                <span className="hidden size-14 shrink-0 overflow-hidden rounded-lg sm:block">
                  <Imagem src={img?.src} compacto />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {c.cor_nome && <RotuloCor nome={c.cor_nome} hex={c.cor_hex ?? '#a1a1aa'} />}
                    {c.tamanho && <span className="rotulo">{ROTULO_TAMANHO[c.tamanho]}</span>}
                    <span className="rotulo">{c.qtd_itens ? plural(c.qtd_itens, 'material', 'materiais') : 'Sem materiais'}</span>
                  </span>
                  {c.local && (
                    <span className="flex items-center gap-1 truncate text-sm text-zinc-500">
                      <MapPin className="size-3.5 shrink-0" /> {c.local}
                    </span>
                  )}
                </span>
                <SeloEstado estado={estado} data={c.conferido_em} className="hidden md:inline-flex" />
                <StatusIcone estado={estado} tamanho="sm" className="md:hidden" />
                <ChevronRight className={cn('size-5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5')} />
              </Link>
            </li>
          )
        })}
      </ul>

      {podeEditar && (
        <>
          <FormCaixa
            aberto={novaAberta}
            aoFechar={() => setNovaAberta(false)}
            inicial={{
              nome: grupo.nome,
              cor_id: ref.cor_id,
              tamanho: ref.tamanho,
              foto_modelo: ref.foto_modelo,
              local: ref.local,
              copiarDe: modeloConteudo?.id ?? null,
            }}
          />
          <FormTipo aberto={editarAberto} aoFechar={() => setEditarAberto(false)} grupo={grupo} />
          {modeloConteudo && (
            <CopiarConteudo aberto={copiarAberto} aoFechar={() => setCopiarAberto(false)} origem={modeloConteudo} />
          )}
        </>
      )}
    </div>
  )
}
