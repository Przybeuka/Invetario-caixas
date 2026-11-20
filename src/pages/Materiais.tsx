import { LayoutGrid, List, Package, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePermissoes } from '../auth/auth'
import { FormMaterial } from '../components/FormMaterial'
import { Imagem, Miniatura } from '../components/Imagens'
import { Botao, CampoBusca, Carregando, Chip, ErroCarga, Segmentado, Vazio } from '../components/ui'
import { useCores, useMateriais } from '../lib/api'
import { modeloDoMaterial, ordenarMateriais } from '../lib/materiaisCaixa'
import { srcModelo } from '../lib/modelos'
import { urlFoto } from '../lib/supabase'
import type { MaterialResumo } from '../lib/tipos'
import { formatarQtd, normalizar, plural } from '../lib/util'

type Visao = 'lista' | 'grade'

function linhaUso(m: MaterialResumo) {
  if (!m.qtd_caixas) return 'Em nenhuma caixa'
  return `${plural(m.qtd_caixas, 'caixa', 'caixas')} · total ${formatarQtd(m.qtd_total)} ${m.unidade}`
}

export function Materiais() {
  const { podeEditar } = usePermissoes()
  const navigate = useNavigate()
  const { data: materiais = [], isLoading, error } = useMateriais()
  const { data: cores = [] } = useCores()
  const [params, setParams] = useSearchParams()
  const [visao, setVisao] = useState<Visao>(() => {
    try {
      return localStorage.getItem('visao-materiais') === 'grade' ? 'grade' : 'lista'
    } catch {
      return 'lista'
    }
  })
  const [novoAberto, setNovoAberto] = useState(false)

  const busca = params.get('q') ?? ''
  const categoria = params.get('categoria') ?? ''

  function mudar(chave: string, valor: string) {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
  }

  const categorias = useMemo(
    () => [...new Set(materiais.map((m) => m.categoria).filter((c): c is string => !!c))].sort(),
    [materiais],
  )
  const termo = normalizar(busca)
  const filtrados = useMemo(
    () =>
      ordenarMateriais(materiais, (m) => m.nome, cores).filter((m) => {
        if (categoria === '__sem' ? m.categoria : categoria && m.categoria !== categoria) return false
        if (!termo) return true
        const alvo = normalizar(`${m.nome} ${m.categoria ?? ''} ${m.descricao ?? ''}`)
        return termo.split(' ').every((p) => alvo.includes(p))
      }),
    [materiais, cores, categoria, termo],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <CampoBusca valor={busca} aoMudar={(v) => mudar('q', v)} placeholder="Buscar material" className="flex-1" />
        {podeEditar && (
          <Botao variante="primario" tamanho="lg" className="h-12" icone={<Plus className="size-5" />} onClick={() => setNovoAberto(true)}>
            <span className="hidden sm:inline">Novo material</span>
          </Botao>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          <Chip ativo={!categoria} onClick={() => mudar('categoria', '')}>
            Todos
          </Chip>
          {categorias.map((c) => (
            <Chip key={c} ativo={categoria === c} onClick={() => mudar('categoria', categoria === c ? '' : c)}>
              {c}
            </Chip>
          ))}
          {categorias.length > 0 && materiais.some((m) => !m.categoria) && (
            <Chip ativo={categoria === '__sem'} onClick={() => mudar('categoria', categoria === '__sem' ? '' : '__sem')}>
              Sem categoria
            </Chip>
          )}
        </div>
        <Segmentado
          rotulo="Modo de exibição"
          valor={visao}
          aoMudar={(v) => {
            setVisao(v)
            try {
              localStorage.setItem('visao-materiais', v)
            } catch {
              /* modo privado */
            }
          }}
          opcoes={[
            { valor: 'lista', rotulo: 'Lista', icone: <List className="size-4" /> },
            { valor: 'grade', rotulo: 'Grade', icone: <LayoutGrid className="size-4" /> },
          ]}
        />
      </div>

      {error ? (
        <ErroCarga erro={error} />
      ) : isLoading ? (
        <Carregando />
      ) : !materiais.length ? (
        <Vazio
          icone={<Package className="size-12" strokeWidth={1.25} />}
          titulo="Catálogo vazio"
          texto="Cadastre materiais aqui ou direto dentro de uma caixa, em “Adicionar material”."
          acao={
            podeEditar && (
              <Botao variante="primario" icone={<Plus className="size-4" />} onClick={() => setNovoAberto(true)}>
                Novo material
              </Botao>
            )
          }
        />
      ) : (
        <>
          <p className="rotulo">
            {filtrados.length === materiais.length
              ? plural(materiais.length, 'material', 'materiais')
              : `${filtrados.length} de ${materiais.length} materiais`}
          </p>
          {!filtrados.length ? (
            <Vazio titulo="Nada encontrado" texto={`Nenhum material com “${busca}”.`} />
          ) : visao === 'lista' ? (
            <ul className="cartao divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtrados.map((m) => (
                <li key={m.id}>
                  <Link to={`/materiais/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <Miniatura caminho={m.fotos?.[0]} modelo={modeloDoMaterial(m.nome, cores)} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{m.nome}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {[m.categoria, linhaUso(m)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtrados.map((m) => (
                <Link key={m.id} to={`/materiais/${m.id}`} className="cartao overflow-hidden transition hover:shadow-md">
                  <div className="aspect-square overflow-hidden">
                    {modeloDoMaterial(m.nome, cores) ? (
                      <Imagem src={srcModelo(modeloDoMaterial(m.nome, cores) as string, true)} alt={m.nome} className="object-contain" />
                    ) : (
                      <Imagem src={m.fotos?.[0] ? urlFoto(m.fotos[0]) : null} alt={m.nome} />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug">{m.nome}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{linhaUso(m)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <FormMaterial
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        nomeInicial={busca}
        aoCriar={(m) => navigate(`/materiais/${m.id}`)}
      />
    </div>
  )
}
