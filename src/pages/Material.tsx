import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePermissoes } from '../auth/auth'
import { useAvisos } from '../components/avisos'
import { FormMaterial } from '../components/FormMaterial'
import { Galeria } from '../components/Imagens'
import { Modal } from '../components/Modal'
import { Botao, Campo, Carregando, classeBotao, PassoQuantidade, Ponto, Secao, Vazio } from '../components/ui'
import {
  adicionarItem,
  excluirMaterial,
  useAcao,
  useCaixas,
  useCores,
  useFotos,
  useMateriais,
  useUsoMaterial,
} from '../lib/api'
import { modeloDoMaterial } from '../lib/materiaisCaixa'
import { formatarQtd, mensagemErro, plural } from '../lib/util'

function AdicionarACaixa({
  aberto,
  aoFechar,
  materialId,
  nome,
  jaEm,
}: {
  aberto: boolean
  aoFechar: () => void
  materialId: string
  nome: string
  jaEm: Set<string>
}) {
  const { data: caixas = [] } = useCaixas()
  const [caixaId, setCaixaId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const adicionar = useAcao(
    () => adicionarItem({ caixa_id: caixaId, material_id: materialId, quantidade }),
    () => `${nome} adicionado à caixa ${caixas.find((c) => c.id === caixaId)?.numero ?? ''}.`,
  )
  const disponiveis = caixas.filter((c) => !jaEm.has(c.id))
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Adicionar a uma caixa"
      subtitulo={nome}
      rodape={
        <div className="flex justify-end gap-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={!caixaId}
            carregando={adicionar.isPending}
            onClick={() =>
              adicionar.mutate(undefined, {
                onSuccess: () => {
                  setCaixaId('')
                  setQuantidade(1)
                  aoFechar()
                },
              })
            }
          >
            Adicionar
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo rotulo="Caixa">
          <select className="campo" value={caixaId} onChange={(e) => setCaixaId(e.target.value)}>
            <option value="">Escolha a caixa…</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                Nº {c.numero} · {c.nome}
                {c.cor_nome ? ` · ${c.cor_nome}` : ''}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex items-center justify-between gap-3">
          <span className="rotulo">Quantidade</span>
          <PassoQuantidade valor={quantidade} aoMudar={setQuantidade} min={0.01} />
        </div>
      </div>
    </Modal>
  )
}

export function MaterialPagina() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { podeEditar, ehAdmin } = usePermissoes()
  const { confirmar, avisar } = useAvisos()
  const { data: materiais = [], isLoading } = useMateriais()
  const { data: cores = [] } = useCores()
  const material = materiais.find((m) => m.id === id)
  const { data: usos = [] } = useUsoMaterial(id)
  const { data: fotos = [] } = useFotos(id ? { material_id: id } : null)
  const [editarAberto, setEditarAberto] = useState(false)
  const [adicionarAberto, setAdicionarAberto] = useState(false)
  const jaEm = useMemo(() => new Set(usos.map((u) => u.caixa.id)), [usos])

  if (isLoading) return <Carregando />
  if (!material)
    return (
      <Vazio
        titulo="Material não encontrado"
        acao={
          <Link to="/materiais" className={classeBotao('primario')}>
            Voltar para materiais
          </Link>
        }
      />
    )

  async function excluir() {
    if (!material) return
    const ok = await confirmar({
      titulo: 'Excluir material?',
      mensagem: material.qtd_caixas
        ? `“${material.nome}” também sai de ${plural(material.qtd_caixas, 'caixa', 'caixas')}. Isso não pode ser desfeito.`
        : `“${material.nome}” será removido do catálogo.`,
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return
    try {
      await excluirMaterial(material.id)
      avisar('Material excluído.')
      navigate('/materiais', { replace: true })
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link to="/materiais" className="rotulo inline-flex items-center gap-1.5 self-start hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Materiais
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Galeria
          fotos={fotos}
          dono={{ material_id: material.id }}
          podeEditar={podeEditar}
          alt={material.nome}
          modelo={modeloDoMaterial(material.nome, cores)}
        />
        <div className="flex flex-col gap-4">
          <div>
            {material.categoria && <div className="rotulo">{material.categoria}</div>}
            <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">{material.nome}</h1>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="cartao p-3">
              <div className="rotulo">Caixas</div>
              <div className="font-display text-3xl font-bold">{material.qtd_caixas}</div>
            </div>
            <div className="cartao p-3">
              <div className="rotulo">Total</div>
              <div className="font-display text-3xl font-bold">{formatarQtd(material.qtd_total)}</div>
            </div>
            <div className="cartao p-3">
              <div className="rotulo">Unidade</div>
              <div className="font-display text-3xl font-bold">{material.unidade}</div>
            </div>
          </div>
          {material.descricao && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{material.descricao}</p>}
          <div className="flex flex-wrap gap-2">
            {podeEditar && (
              <>
                <Botao variante="primario" icone={<Plus className="size-4" />} onClick={() => setAdicionarAberto(true)}>
                  Adicionar a uma caixa
                </Botao>
                <Botao icone={<Pencil className="size-4" />} onClick={() => setEditarAberto(true)}>
                  Editar
                </Botao>
              </>
            )}
            {ehAdmin && (
              <Botao variante="fantasma" className="text-red-600 dark:text-red-400" icone={<Trash2 className="size-4" />} onClick={excluir}>
                Excluir
              </Botao>
            )}
          </div>
        </div>
      </div>

      <Secao titulo="Onde está">
        {usos.length ? (
          <ul className="cartao divide-y divide-zinc-100 dark:divide-zinc-800">
            {usos.map((u) => (
              <li key={u.id}>
                <Link to={`/caixas/${u.caixa.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <span className="w-14 text-center font-display text-3xl font-bold tabular-nums">{u.caixa.numero}</span>
                  {u.caixa.cor && <Ponto hex={u.caixa.cor.hex} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.caixa.nome}</span>
                    {u.observacao && <span className="block truncate text-xs text-zinc-500">{u.observacao}</span>}
                  </span>
                  <span className="whitespace-nowrap font-display text-2xl font-bold tabular-nums">
                    {formatarQtd(u.quantidade)} <span className="text-sm text-zinc-500">{material.unidade}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Este material ainda não está em nenhuma caixa.</p>
        )}
      </Secao>

      {podeEditar && (
        <>
          <FormMaterial aberto={editarAberto} aoFechar={() => setEditarAberto(false)} material={material} />
          <AdicionarACaixa
            aberto={adicionarAberto}
            aoFechar={() => setAdicionarAberto(false)}
            materialId={material.id}
            nome={material.nome}
            jaEm={jaEm}
          />
        </>
      )}
    </div>
  )
}
