import { useQueryClient } from '@tanstack/react-query'
import { Check, CircleCheck, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { adicionarItem, criarMaterial, useCores, useMateriais, type DadosMaterial } from '../lib/api'
import { modeloDoMaterial, ordenarMateriais } from '../lib/materiaisCaixa'
import type { MaterialResumo } from '../lib/tipos'
import { cn, mensagemErro, normalizar, plural } from '../lib/util'
import { useAvisos } from './avisos'
import { CamposMaterial, limparDadosMaterial } from './FormMaterial'
import { Miniatura } from './Imagens'
import { Modal } from './Modal'
import { Botao, CampoBusca, Campo, PassoQuantidade } from './ui'

/**
 * Adiciona materiais a uma caixa: busca no catálogo ou cria um novo na hora.
 * A janela continua aberta para lançar vários itens em sequência.
 */
export function AdicionarMaterial({
  aberto,
  aoFechar,
  caixaId,
  numeroCaixa,
  jaNaCaixa,
}: {
  aberto: boolean
  aoFechar: () => void
  caixaId: string
  numeroCaixa: number
  jaNaCaixa: Set<string>
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Adicionar material"
      subtitulo={`Caixa ${numeroCaixa}`}
      largura="max-w-xl"
      rodape={
        <div className="flex justify-end">
          <Botao variante="primario" onClick={aoFechar}>
            Concluir
          </Botao>
        </div>
      }
    >
      <Conteudo caixaId={caixaId} jaNaCaixa={jaNaCaixa} />
    </Modal>
  )
}

type Etapa = { tipo: 'busca' } | { tipo: 'existente'; material: MaterialResumo } | { tipo: 'novo' }

function Conteudo({ caixaId, jaNaCaixa }: { caixaId: string; jaNaCaixa: Set<string> }) {
  const { data: materiaisBrutos = [] } = useMateriais()
  const { data: cores = [] } = useCores()
  const materiais = useMemo(() => ordenarMateriais(materiaisBrutos, (m) => m.nome, cores), [materiaisBrutos, cores])
  const { avisar } = useAvisos()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'busca' })
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [novo, setNovo] = useState<DadosMaterial>({ nome: '', unidade: 'un', categoria: '', descricao: '' })
  const [salvando, setSalvando] = useState(false)
  const [ultimos, setUltimos] = useState<string[]>([])

  const termo = normalizar(busca)
  const resultados = useMemo(() => {
    if (!termo) return materiais.slice(0, 40)
    const partes = termo.split(' ')
    return materiais
      .filter((m) => {
        const alvo = normalizar(`${m.nome} ${m.categoria ?? ''}`)
        return partes.every((p) => alvo.includes(p))
      })
      .slice(0, 40)
  }, [materiais, termo])
  const existeExato = materiais.some((m) => normalizar(m.nome) === termo)

  function reiniciar(nomeAdicionado: string) {
    setUltimos((u) => [nomeAdicionado, ...u].slice(0, 5))
    setBusca('')
    setQuantidade(1)
    setObservacao('')
    setNovo({ nome: '', unidade: 'un', categoria: '', descricao: '' })
    setEtapa({ tipo: 'busca' })
  }

  async function adicionarExistente(m: MaterialResumo) {
    setSalvando(true)
    try {
      await adicionarItem({ caixa_id: caixaId, material_id: m.id, quantidade, observacao })
      await qc.invalidateQueries()
      avisar(`${m.nome} adicionado.`)
      reiniciar(m.nome)
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function criarEAdicionar() {
    const dados = limparDadosMaterial(novo)
    if (!dados.nome) return
    setSalvando(true)
    try {
      const material = await criarMaterial(dados)
      await adicionarItem({ caixa_id: caixaId, material_id: material.id, quantidade, observacao })
      await qc.invalidateQueries()
      avisar(`${material.nome} criado e adicionado.`)
      reiniciar(material.nome)
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const blocoQuantidade = (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rotulo">Quantidade nesta caixa</span>
        <PassoQuantidade valor={quantidade} aoMudar={setQuantidade} min={0.01} />
      </div>
      <Campo rotulo="Observação (opcional)">
        <input
          className="campo"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: fica no compartimento superior"
        />
      </Campo>
    </div>
  )

  if (etapa.tipo === 'existente') {
    const m = etapa.material
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Miniatura caminho={m.fotos?.[0]} modelo={modeloDoMaterial(m.nome, cores)} className="size-16" />
          <div className="min-w-0">
            <div className="font-display text-2xl font-bold leading-tight">{m.nome}</div>
            <div className="rotulo">
              {[m.categoria, `unidade: ${m.unidade}`].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        {blocoQuantidade}
        <div className="flex justify-between gap-2">
          <Botao onClick={() => setEtapa({ tipo: 'busca' })}>Voltar</Botao>
          <Botao variante="primario" icone={<Plus className="size-4" />} carregando={salvando} onClick={() => adicionarExistente(m)}>
            Adicionar à caixa
          </Botao>
        </div>
      </div>
    )
  }

  if (etapa.tipo === 'novo') {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void criarEAdicionar()
        }}
      >
        <CamposMaterial dados={novo} setDados={setNovo} autoFocus />
        {blocoQuantidade}
        <div className="flex justify-between gap-2">
          <Botao onClick={() => setEtapa({ tipo: 'busca' })}>Voltar</Botao>
          <Botao variante="primario" type="submit" icone={<Plus className="size-4" />} carregando={salvando}>
            Criar e adicionar
          </Botao>
        </div>
        <p className="text-xs text-zinc-500">Fotos do material podem ser adicionadas depois, na página dele.</p>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {ultimos.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          <span>Adicionados agora: {ultimos.join(', ')}</span>
        </div>
      )}
      <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar no catálogo de materiais" autoFocus />
      {termo && !existeExato && (
        <button
          type="button"
          onClick={() => {
            setNovo({ nome: busca.trim(), unidade: 'un', categoria: '', descricao: '' })
            setEtapa({ tipo: 'novo' })
          }}
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-3 text-left transition hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-white"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
            <Plus className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">Criar novo material “{busca.trim()}”</span>
            <span className="text-sm text-zinc-500">Não está no catálogo? Cadastre e já adicione.</span>
          </span>
        </button>
      )}
      <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {resultados.map((m) => {
          const ja = jaNaCaixa.has(m.id)
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={ja}
                onClick={() => {
                  setQuantidade(1)
                  setEtapa({ tipo: 'existente', material: m })
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition',
                  ja ? 'opacity-50' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                <Miniatura caminho={m.fotos?.[0]} modelo={modeloDoMaterial(m.nome, cores)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.nome}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {[m.categoria, m.qtd_caixas ? `em ${plural(m.qtd_caixas, 'caixa', 'caixas')}` : 'em nenhuma caixa']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {ja ? (
                  <span className="rotulo inline-flex items-center gap-1">
                    <Check className="size-3.5" /> Já está
                  </span>
                ) : (
                  <Plus className="size-5 text-zinc-400" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {!resultados.length && !termo && (
        <p className="py-6 text-center text-sm text-zinc-500">
          O catálogo ainda está vazio. Digite o nome do material para criar o primeiro.
        </p>
      )}
    </div>
  )
}
