import {
  ArrowLeft,
  ChevronDown,
  ClipboardCheck,
  Copy,
  CopyPlus,
  Ellipsis,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePermissoes } from '../auth/auth'
import { AdicionarMaterial } from '../components/AdicionarMaterial'
import { useAvisos } from '../components/avisos'
import { CopiarConteudo } from '../components/CopiarConteudo'
import { FormCaixa, type ValoresIniciaisCaixa } from '../components/FormCaixa'
import { Galeria, Miniatura } from '../components/Imagens'
import { modeloDoMaterial, ordenarMateriais } from '../lib/materiaisCaixa'
import { SeloEstado, StatusIcone } from '../components/Status'
import {
  Botao,
  BotaoIcone,
  Carregando,
  classeBotao,
  ItemMenu,
  Menu,
  PassoQuantidade,
  RotuloCor,
  Secao,
  Vazio,
} from '../components/ui'
import {
  atualizarItem,
  excluirCaixa,
  excluirConferencia,
  removerItem,
  useAcao,
  useCaixas,
  useConferencias,
  useFotos,
  useCores,
  useItens,
  useValidade,
} from '../lib/api'
import { estadoDaCaixa, modelo3dDaCaixa, modeloPorTamanho } from '../lib/grupos'
import type { CaixaItem, CaixaResumo, Conferencia } from '../lib/tipos'
import { useTravaSaida } from '../lib/travaSaida'
import {
  cn,
  corTexto,
  DIA_MS,
  formatarData,
  formatarDataHora,
  formatarQtd,
  mensagemErro,
  normalizar,
  plural,
  ROTULO_TAMANHO,
  formatarDecimal,
  volumeM3,
  tempoRelativo,
} from '../lib/util'

/** Quantidade editável: a mudança fica pendente até tocar em “Salvar alterações”. */
function QuantidadeItem({ valor, aoMudar }: { valor: number; aoMudar: (v: number) => void }) {
  const { avisar } = useAvisos()
  function mudar(v: number) {
    if (v <= 0) {
      avisar('Para tirar o material da caixa, use a lixeira.', 'info')
      return
    }
    aoMudar(v)
  }
  return <PassoQuantidade valor={valor} aoMudar={mudar} min={0} />
}

/** Barra com o botão de salvar, repetida acima e abaixo da lista de materiais. */
function BarraSalvar({
  alteradas,
  salvando,
  aoSalvar,
  aoDescartar,
}: {
  alteradas: number
  salvando: boolean
  aoSalvar: () => void
  aoDescartar: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 transition',
        alteradas
          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900'
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900',
      )}
    >
      <span className="text-sm font-semibold">
        {alteradas
          ? `${alteradas} ${alteradas === 1 ? 'quantidade alterada' : 'quantidades alteradas'} sem salvar`
          : 'Nenhuma alteração pendente'}
      </span>
      <div className="flex gap-2">
        {alteradas > 0 && (
          <Botao onClick={aoDescartar} disabled={salvando}>
            Descartar
          </Botao>
        )}
        <Botao variante="primario" icone={<Save className="size-4" />} onClick={aoSalvar} disabled={!alteradas || salvando}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </Botao>
      </div>
    </div>
  )
}

function LinhaItem({
  item,
  podeEditar,
  modelo,
  valor,
  aoMudar,
}: {
  item: CaixaItem
  podeEditar: boolean
  modelo: string | null
  valor: number
  aoMudar: (v: number) => void
}) {
  const { confirmar } = useAvisos()
  const remover = useAcao(() => removerItem(item.id), `${item.material.nome} removido da caixa.`)
  const capa = [...(item.material.fotos ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.caminho_miniatura

  return (
    <li className="flex items-center gap-3 py-3">
      <Link to={`/materiais/${item.material_id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Miniatura caminho={capa} modelo={modelo} className="size-14" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{item.material.nome}</span>
          <span className="block truncate text-xs text-zinc-500">
            {[item.material.categoria, item.observacao].filter(Boolean).join(' · ') || item.material.unidade}
          </span>
        </span>
      </Link>
      {podeEditar ? (
        <div className="flex items-center gap-1">
          <QuantidadeItem valor={valor} aoMudar={aoMudar} />
          <span className="rotulo hidden w-10 sm:block">{item.material.unidade}</span>
          <BotaoIcone
            rotulo={`Remover ${item.material.nome}`}
            className="text-red-600 dark:text-red-400"
            onClick={async () => {
              const ok = await confirmar({
                titulo: 'Remover da caixa?',
                mensagem: `“${item.material.nome}” sai desta caixa. O material continua no catálogo.`,
                confirmar: 'Remover',
                perigo: true,
              })
              if (ok) remover.mutate(undefined)
            }}
          >
            <Trash2 className="size-5" />
          </BotaoIcone>
        </div>
      ) : (
        <span className="whitespace-nowrap font-display text-2xl font-bold tabular-nums">
          {formatarQtd(item.quantidade)}
          <span className="ml-1 text-sm font-semibold text-zinc-500">{item.material.unidade}</span>
        </span>
      )}
    </li>
  )
}

function LinhaConferencia({ c, ehAdmin }: { c: Conferencia; ehAdmin: boolean }) {
  const [aberto, setAberto] = useState(false)
  const { confirmar } = useAvisos()
  const excluir = useAcao(() => excluirConferencia(c.id), 'Conferência excluída.')
  const faltas = c.itens.filter((i) => Number(i.quantidade_encontrada) < Number(i.quantidade_esperada))
  const naoEncontrados = faltas.filter((i) => Number(i.quantidade_encontrada) === 0)
  const comObs = c.itens.filter((i) => i.observacao)
  const temDetalhes = faltas.length > 0 || comObs.length > 0 || !!c.observacao

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <StatusIcone estado={c.status === 'ok' ? 'ok' : 'pendencia'} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {formatarDataHora(c.conferido_em)}
            {c.conferido_por_nome && <span className="font-normal text-zinc-500"> · {c.conferido_por_nome}</span>}
          </div>
          <div className="text-xs text-zinc-500">
            {c.status === 'ok'
              ? 'Tudo certo'
              : faltas.length
                ? [
                    naoEncontrados.length && plural(naoEncontrados.length, 'não encontrado', 'não encontrados'),
                    faltas.length - naoEncontrados.length &&
                      plural(faltas.length - naoEncontrados.length, 'incompleto', 'incompletos'),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Pendência registrada'}
            {' · '}
            {plural(c.itens.length, 'item conferido', 'itens conferidos')}
          </div>
        </div>
        {temDetalhes && (
          <BotaoIcone rotulo="Detalhes" onClick={() => setAberto(!aberto)}>
            <ChevronDown className={cn('size-5 transition', aberto && 'rotate-180')} />
          </BotaoIcone>
        )}
        {ehAdmin && (
          <BotaoIcone
            rotulo="Excluir conferência"
            onClick={async () => {
              if (
                await confirmar({
                  titulo: 'Excluir conferência?',
                  mensagem: 'Use só para registros feitos por engano.',
                  confirmar: 'Excluir',
                  perigo: true,
                })
              )
                excluir.mutate(undefined)
            }}
          >
            <Trash2 className="size-4" />
          </BotaoIcone>
        )}
      </div>
      {aberto && (
        <div className="ml-9 mt-2 flex flex-col gap-1 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-950/50">
          {c.observacao && <p className="italic text-zinc-600 dark:text-zinc-300">“{c.observacao}”</p>}
          {c.itens
            .filter((i) => Number(i.quantidade_encontrada) < Number(i.quantidade_esperada) || i.observacao)
            .map((i) => (
              <p key={i.id}>
                <span className="font-semibold">{i.material_nome}</span>:{' '}
                {Number(i.quantidade_encontrada) === 0
                  ? 'não encontrado'
                  : Number(i.quantidade_encontrada) < Number(i.quantidade_esperada)
                    ? `incompleto (${formatarQtd(i.quantidade_encontrada)} de ${formatarQtd(i.quantidade_esperada)})`
                    : `${formatarQtd(i.quantidade_encontrada)} de ${formatarQtd(i.quantidade_esperada)}`}
                {i.observacao && <span className="text-zinc-500"> — {i.observacao}</span>}
              </p>
            ))}
        </div>
      )}
    </li>
  )
}

export function CaixaPagina() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { podeConferir, podeEditar, ehAdmin } = usePermissoes()
  const { confirmar, avisar, escolher } = useAvisos()
  const qc = useQueryClient()
  const { data: caixas = [], isLoading } = useCaixas()
  const validade = useValidade()
  const caixa = caixas.find((c) => c.id === id)
  const { data: itensBrutos = [], isLoading: carregandoItens } = useItens(id)
  const { data: cores = [] } = useCores()
  const itens = useMemo(() => ordenarMateriais(itensBrutos, (i) => i.material.nome, cores), [itensBrutos, cores])
  const { data: fotos = [] } = useFotos(id ? { caixa_id: id } : null)
  const { data: conferencias = [] } = useConferencias(id)

  const [editarAberto, setEditarAberto] = useState(false)
  const [duplicarAberto, setDuplicarAberto] = useState(false)
  const [adicionarAberto, setAdicionarAberto] = useState(false)
  const [copiarAberto, setCopiarAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  // Quantidades alteradas e ainda não salvas (id do item → nova quantidade).
  const [pendentes, setPendentes] = useState<Record<string, number>>({})
  const [salvandoQtd, setSalvandoQtd] = useState(false)
  const alteradas = itens.filter((i) => pendentes[i.id] !== undefined && pendentes[i.id] !== Number(i.quantidade)).length

  function mudarQuantidade(item: CaixaItem, v: number) {
    setPendentes((p) => {
      const n = { ...p }
      if (v === Number(item.quantidade)) delete n[item.id]
      else n[item.id] = v
      return n
    })
  }

  async function salvarQuantidades(): Promise<boolean> {
    const mudancas = itens.filter((i) => pendentes[i.id] !== undefined && pendentes[i.id] !== Number(i.quantidade))
    if (!mudancas.length) return true
    setSalvandoQtd(true)
    try {
      await Promise.all(mudancas.map((i) => atualizarItem(i.id, { quantidade: pendentes[i.id] })))
      await qc.invalidateQueries()
      setPendentes({})
      avisar(mudancas.length === 1 ? 'Quantidade salva.' : `${mudancas.length} quantidades salvas.`)
      return true
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
      return false
    } finally {
      setSalvandoQtd(false)
    }
  }

  useTravaSaida(alteradas > 0, async () => {
    const r = await escolher({
      titulo: 'Salvar antes de sair?',
      mensagem: 'Você alterou quantidades de materiais desta caixa e ainda não salvou.',
      sim: 'Sim, salvar',
      nao: 'Sair sem salvar',
      cancelar: 'Continuar editando',
    })
    if (r === 'cancelar') return false
    if (r === 'sim') return salvarQuantidades()
    setPendentes({})
    return true
  })

  const jaNaCaixa = useMemo(() => new Set(itens.map((i) => i.material_id)), [itens])
  const mesmoTipo = useMemo(
    () => (caixa ? caixas.filter((c) => normalizar(c.nome) === normalizar(caixa.nome)) : []),
    [caixas, caixa],
  )

  if (isLoading) return <Carregando />
  if (!caixa)
    return (
      <Vazio
        titulo="Caixa não encontrada"
        texto="Ela pode ter sido excluída."
        acao={
          <Link to="/" className={classeBotao('primario')}>
            Voltar para caixas
          </Link>
        }
      />
    )

  const estado = estadoDaCaixa(caixa, validade)
  const voltarPara = mesmoTipo.length > 1 ? `/tipo/${encodeURIComponent(caixa.nome)}` : '/'
  const proximoNumero = caixas.reduce((m, c) => Math.max(m, c.numero), 0) + 1
  const venceEm =
    caixa.conferido_em && validade > 0 ? new Date(new Date(caixa.conferido_em).getTime() + validade * DIA_MS) : null
  const duplicata: ValoresIniciaisCaixa = {
    nome: caixa.nome,
    cor_id: caixa.cor_id,
    tamanho: caixa.tamanho,
    local: caixa.local,
    observacoes: caixa.observacoes,
    foto_modelo: caixa.foto_modelo,
    numero: proximoNumero,
    copiarDe: caixa.qtd_itens ? caixa.id : null,
  }

  async function excluir() {
    if (!caixa) return
    const ok = await confirmar({
      titulo: `Excluir a caixa ${caixa.numero}?`,
      mensagem: (
        <>
          A caixa “{caixa.nome}” será excluída junto com {plural(caixa.qtd_itens, 'material', 'materiais')}, fotos e
          conferências. A lista do que havia nela fica guardada no histórico.
        </>
      ),
      confirmar: 'Excluir caixa',
      perigo: true,
    })
    if (!ok) return
    setExcluindo(true)
    try {
      await excluirCaixa(caixa.id)
      avisar(`Caixa ${caixa.numero} excluída.`)
      navigate(voltarPara === '/' || mesmoTipo.length <= 2 ? '/' : voltarPara, { replace: true })
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
      setExcluindo(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to={voltarPara}
        className="rotulo inline-flex items-center gap-1.5 self-start hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> {mesmoTipo.length > 1 ? caixa.nome : 'Caixas'}
      </Link>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Galeria
          fotos={fotos}
          dono={{ caixa_id: caixa.id }}
          podeEditar={podeEditar}
          modelo={caixa.foto_modelo || modeloPorTamanho(caixa.cor_nome, caixa.tamanho) || caixa.cor_foto_modelo}
          modelo3d={modelo3dDaCaixa(caixa.cor_nome, caixa.tamanho)}
          alt={`Caixa ${caixa.numero} · ${caixa.nome}`}
        />

        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div
              className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl shadow-md ring-1 ring-black/10 sm:size-24"
              style={{ background: caixa.cor_hex ?? '#3f3f46', color: corTexto(caixa.cor_hex ?? '#3f3f46') }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">Nº</span>
              <span className="font-display text-5xl font-bold leading-none sm:text-6xl">{caixa.numero}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">{caixa.nome}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {caixa.cor_nome && <RotuloCor nome={caixa.cor_nome} hex={caixa.cor_hex ?? '#a1a1aa'} />}
                {caixa.tamanho && <span className="rotulo">{ROTULO_TAMANHO[caixa.tamanho]}</span>}
                {caixa.local && (
                  <span className="rotulo inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {caixa.local}
                  </span>
                )}
              </div>
              <Medidas caixa={caixa} />
            </div>
          </div>

          <div className="cartao flex items-center gap-3 p-4">
            <StatusIcone estado={estado} tamanho="lg" />
            <div className="min-w-0 flex-1 text-sm">
              <SeloEstado estado={estado} />
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                {caixa.conferido_em ? (
                  <>
                    Última conferência {tempoRelativo(caixa.conferido_em)}
                    {caixa.conferido_por_nome && <> por {caixa.conferido_por_nome}</>}
                    {venceEm && caixa.conferencia_status === 'ok' && (
                      <> · {estado === 'vencida' ? 'venceu em' : 'vale até'} {formatarData(venceEm.toISOString())}</>
                    )}
                  </>
                ) : (
                  'Esta caixa ainda não foi conferida.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {podeConferir && (
              <Link to={`/caixas/${caixa.id}/conferir`} className={cn(classeBotao('primario', 'lg'), 'w-full sm:w-auto')}>
                <ClipboardCheck className="size-5" /> Conferir caixa
              </Link>
            )}
            {podeEditar && (
              <Botao
                tamanho="lg"
                icone={<Pencil className="size-4" />}
                onClick={() => setEditarAberto(true)}
                className="max-sm:flex-1 max-sm:px-3"
              >
                Editar
              </Botao>
            )}
            {podeConferir && (
              <Botao
                tamanho="lg"
                icone={<Printer className="size-4" />}
                onClick={() => navigate(`/imprimir?caixa=${caixa.id}`)}
                className="max-sm:flex-1 max-sm:px-3"
              >
                Imprimir
              </Botao>
            )}
            {/* Telas maiores: ações como botões. */}
            {podeEditar && (
              <Botao
                tamanho="lg"
                icone={<CopyPlus className="size-4" />}
                onClick={() => setDuplicarAberto(true)}
                className="hidden sm:inline-flex"
              >
                Duplicar
              </Botao>
            )}
            {podeEditar && caixa.qtd_itens > 0 && (
              <Botao
                tamanho="lg"
                icone={<Copy className="size-4" />}
                onClick={() => setCopiarAberto(true)}
                className="hidden sm:inline-flex"
              >
                Copiar conteúdo
              </Botao>
            )}
            {ehAdmin && (
              <Botao
                tamanho="lg"
                variante="perigo"
                icone={<Trash2 className="size-4" />}
                disabled={excluindo}
                onClick={() => void excluir()}
                className="hidden sm:inline-flex"
              >
                Excluir
              </Botao>
            )}
            {/* Celular: o resto fica no menu (os três pontos). */}
            {(podeEditar || ehAdmin) && (
              <div className="sm:hidden">
                <Menu
                  botao={(abrir) => (
                    <Botao tamanho="lg" onClick={abrir} aria-label="Mais ações" className="max-sm:px-4">
                      <Ellipsis className="size-5" />
                    </Botao>
                  )}
                >
                  {(fechar) => (
                    <>
                      {podeEditar && (
                        <ItemMenu
                          icone={<CopyPlus className="size-4" />}
                          onClick={() => {
                            fechar()
                            setDuplicarAberto(true)
                          }}
                        >
                          Duplicar caixa
                        </ItemMenu>
                      )}
                      {podeEditar && caixa.qtd_itens > 0 && (
                        <ItemMenu
                          icone={<Copy className="size-4" />}
                          onClick={() => {
                            fechar()
                            setCopiarAberto(true)
                          }}
                        >
                          Copiar conteúdo para…
                        </ItemMenu>
                      )}
                      {ehAdmin && (
                        <ItemMenu
                          perigo
                          disabled={excluindo}
                          icone={<Trash2 className="size-4" />}
                          onClick={() => {
                            fechar()
                            void excluir()
                          }}
                        >
                          Excluir caixa
                        </ItemMenu>
                      )}
                    </>
                  )}
                </Menu>
              </div>
            )}
          </div>

          {caixa.observacoes && (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="rotulo mb-1 text-amber-800 dark:text-amber-300">Observações</div>
              <p className="whitespace-pre-line">{caixa.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      <Secao
        titulo={
          <>
            Materiais <span className="text-zinc-400">{itens.length}</span>
          </>
        }
        acao={
          podeEditar && (
            <Botao variante="primario" icone={<Plus className="size-4" />} onClick={() => setAdicionarAberto(true)}>
              Adicionar material
            </Botao>
          )
        }
      >
        {carregandoItens ? (
          <Carregando />
        ) : itens.length ? (
          <div className="flex flex-col gap-3">
            {podeEditar && (
              <BarraSalvar
                alteradas={alteradas}
                salvando={salvandoQtd}
                aoSalvar={() => void salvarQuantidades()}
                aoDescartar={() => setPendentes({})}
              />
            )}
            <ul className="cartao divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
              {itens.map((item) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  podeEditar={podeEditar}
                  modelo={modeloDoMaterial(item.material.nome, cores, caixa.tamanho)}
                  valor={pendentes[item.id] ?? Number(item.quantidade)}
                  aoMudar={(v) => mudarQuantidade(item, v)}
                />
              ))}
            </ul>
            {podeEditar && (
              <BarraSalvar
                alteradas={alteradas}
                salvando={salvandoQtd}
                aoSalvar={() => void salvarQuantidades()}
                aoDescartar={() => setPendentes({})}
              />
            )}
          </div>
        ) : (
          <Vazio
            icone={<Package className="size-10" strokeWidth={1.25} />}
            titulo="Caixa sem materiais"
            texto={podeEditar ? 'Adicione do catálogo ou crie materiais novos na hora.' : 'Nenhum material cadastrado nesta caixa.'}
            acao={
              podeEditar &&
              mesmoTipo.some((c) => c.qtd_itens > 0 && c.id !== caixa.id) && (
                <p className="text-sm text-zinc-500">
                  Dica: abra uma caixa do mesmo tipo e use “Copiar conteúdo para…”.
                </p>
              )
            }
          />
        )}
      </Secao>

      <Secao titulo="Conferências">
        {conferencias.length ? (
          <ul className="cartao divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
            {conferencias.map((c) => (
              <LinhaConferencia key={c.id} c={c} ehAdmin={ehAdmin} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Nenhuma conferência registrada.</p>
        )}
      </Secao>

      {podeEditar && (
        <>
          <FormCaixa aberto={editarAberto} aoFechar={() => setEditarAberto(false)} caixa={caixa} />
          <FormCaixa aberto={duplicarAberto} aoFechar={() => setDuplicarAberto(false)} inicial={duplicata} />
          <AdicionarMaterial
            aberto={adicionarAberto}
            aoFechar={() => setAdicionarAberto(false)}
            caixaId={caixa.id}
            numeroCaixa={caixa.numero}
            jaNaCaixa={jaNaCaixa}
          />
          <CopiarConteudo aberto={copiarAberto} aoFechar={() => setCopiarAberto(false)} origem={caixa} />
        </>
      )}
    </div>
  )
}

function Medidas({ caixa }: { caixa: CaixaResumo }) {
  const v = volumeM3(caixa)
  const partes = [
    caixa.comprimento_cm && caixa.largura_cm && caixa.altura_cm
      ? `${formatarDecimal(caixa.comprimento_cm)} × ${formatarDecimal(caixa.largura_cm)} × ${formatarDecimal(caixa.altura_cm)} cm`
      : null,
    v ? `${formatarDecimal(v, 4)} m³` : null,
    caixa.peso_kg ? `${formatarDecimal(caixa.peso_kg)} kg` : null,
  ].filter(Boolean)
  if (!partes.length) return null
  return <p className="mt-1.5 text-sm tabular-nums text-zinc-500">{partes.join('  ·  ')}</p>
}
