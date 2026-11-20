import { Printer, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QR } from '../components/QR'
import { Botao, Campo, Carregando, Segmentado, Vazio } from '../components/ui'
import { useCaixas, useCores, useTodosItens, type ItemResumido } from '../lib/api'
import type { CaixaResumo } from '../lib/tipos'
import { cn, corTexto, formatarData, formatarQtd, normalizar, ROTULO_TAMANHO } from '../lib/util'

type Documento = 'adesivos' | 'lista'
type ModeloAdesivo = 'materiais' | 'geral'
type Fundo = 'branco' | 'preto'

function dividir<T>(lista: T[], tamanho: number): T[][] {
  const partes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho))
  return partes
}

/** Reduz a prévia para caber na tela sem afetar a impressão. */
function useEscala(larguraMm: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const larguraPx = (larguraMm / 25.4) * 96
    const observador = new ResizeObserver(([e]) => setEscala(Math.min(1, e.contentRect.width / larguraPx)))
    observador.observe(el)
    return () => observador.disconnect()
  }, [larguraMm])
  return { ref, escala }
}

function Faixa({ caixa }: { caixa: CaixaResumo }) {
  const hex = caixa.cor_hex ?? '#71717a'
  return (
    <div
      className="flex h-[11mm] shrink-0 items-center justify-between px-[5mm] text-[11pt] font-bold uppercase tracking-[0.2em]"
      style={{ background: hex, color: corTexto(hex) }}
    >
      <span>{caixa.cor_nome ?? 'Sem cor'}</span>
      {caixa.tamanho && <span>{ROTULO_TAMANHO[caixa.tamanho]}</span>}
    </div>
  )
}

function Etiqueta({ fundo, className, children }: { fundo: Fundo; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[3mm] border-[0.4mm]',
        fundo === 'preto' ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-900 bg-white text-zinc-950',
        className,
      )}
    >
      {children}
    </div>
  )
}

function CodigoQR({ caixa, tamanho }: { caixa: CaixaResumo; tamanho: string }) {
  return (
    <div className="shrink-0 rounded-[2mm] bg-white p-[2mm]" style={{ width: tamanho }}>
      <QR texto={`${window.location.origin}/caixas/${caixa.id}`} className="w-full text-black" />
    </div>
  )
}

function AdesivoGeral({ caixa, fundo }: { caixa: CaixaResumo; fundo: Fundo }) {
  return (
    <Etiqueta fundo={fundo} className="h-[134mm] w-[93mm]">
      <Faixa caixa={caixa} />
      <div className="flex flex-1 flex-col items-center justify-center px-[5mm] text-center">
        <div className="text-[9pt] font-bold uppercase tracking-[0.3em] opacity-60">Caixa</div>
        <div className="font-display text-[84pt] font-bold leading-[0.9] tabular-nums">{caixa.numero}</div>
        <div className="mt-[2mm] font-display text-[22pt] font-bold uppercase leading-tight">{caixa.nome}</div>
      </div>
      <div className="flex items-end justify-between gap-[3mm] px-[5mm] pb-[5mm]">
        <div className="text-[8pt] leading-snug opacity-70">
          Aponte a câmera
          <br />
          para ver o conteúdo
        </div>
        <CodigoQR caixa={caixa} tamanho="30mm" />
      </div>
    </Etiqueta>
  )
}

function AdesivoMateriais({
  caixa,
  itens,
  fundo,
}: {
  caixa: CaixaResumo
  itens: ItemResumido[]
  fundo: Fundo
}) {
  const limite = 30
  const visiveis = itens.slice(0, limite)
  const duasColunas = visiveis.length > 12
  return (
    <Etiqueta fundo={fundo} className="h-[134mm] w-full">
      <Faixa caixa={caixa} />
      <div className="flex min-h-0 flex-1 gap-[6mm] p-[6mm]">
        <div className="flex w-[52mm] shrink-0 flex-col">
          <div className="text-[9pt] font-bold uppercase tracking-[0.3em] opacity-60">Caixa</div>
          <div className="font-display text-[72pt] font-bold leading-[0.9] tabular-nums">{caixa.numero}</div>
          <div className="mt-[2mm] font-display text-[18pt] font-bold uppercase leading-tight">{caixa.nome}</div>
          <div className="mt-auto">
            <CodigoQR caixa={caixa} tamanho="30mm" />
          </div>
        </div>
        <div className="min-w-0 flex-1 border-l-[0.3mm] border-current/30 pl-[6mm]">
          <div className="mb-[2mm] text-[9pt] font-bold uppercase tracking-[0.25em] opacity-60">
            Conteúdo · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </div>
          {itens.length ? (
            <ul className={cn('gap-x-[6mm] text-[9.5pt] leading-[1.35]', duasColunas && 'columns-2')}>
              {visiveis.map((i) => (
                <li key={`${i.caixa_id}-${i.material.nome}`} className="flex break-inside-avoid gap-[2mm]">
                  <span className="w-[10mm] shrink-0 text-right font-bold tabular-nums">{formatarQtd(i.quantidade)}</span>
                  <span className="min-w-0">{i.material.nome}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10pt] opacity-60">Conteúdo não cadastrado.</p>
          )}
          {itens.length > limite && (
            <p className="mt-[2mm] text-[8.5pt] font-semibold opacity-70">
              + {itens.length - limite} itens — veja a lista completa pelo QR code.
            </p>
          )}
        </div>
      </div>
    </Etiqueta>
  )
}

function ListaConferencia({
  caixas,
  itensPorCaixa,
}: {
  caixas: CaixaResumo[]
  itensPorCaixa: Map<string, ItemResumido[]>
}) {
  return (
    <div className="folha folha-fluida text-zinc-950">
      <div className="mb-[6mm] flex items-end justify-between border-b-[0.5mm] border-zinc-900 pb-[3mm]">
        <div>
          <div className="text-[9pt] font-bold uppercase tracking-[0.25em] text-zinc-500">Lista de conferência</div>
          <div className="font-display text-[22pt] font-bold uppercase leading-none">Inventário de caixas</div>
        </div>
        <div className="text-right text-[9pt] text-zinc-600">
          Gerada em {formatarData(new Date().toISOString())}
          <br />
          {caixas.length} {caixas.length === 1 ? 'caixa' : 'caixas'}
        </div>
      </div>
      <div className="flex flex-col gap-[6mm]">
        {caixas.map((c) => {
          const itens = itensPorCaixa.get(c.id) ?? []
          return (
            <section key={c.id} className="break-inside-avoid rounded-[2mm] border-[0.3mm] border-zinc-400">
              <header className="flex items-center gap-[4mm] border-b-[0.3mm] border-zinc-400 px-[4mm] py-[2.5mm]">
                <span className="h-[8mm] w-[2mm] rounded-full" style={{ background: c.cor_hex ?? '#71717a' }} />
                <span className="font-display text-[20pt] font-bold leading-none tabular-nums">{c.numero}</span>
                <span className="font-display text-[14pt] font-bold uppercase">{c.nome}</span>
                <span className="ml-auto text-[9pt] uppercase tracking-wider text-zinc-600">
                  {[c.cor_nome, c.tamanho ? ROTULO_TAMANHO[c.tamanho] : null, c.local].filter(Boolean).join(' · ')}
                </span>
              </header>
              {itens.length ? (
                <table className="w-full border-collapse text-[9.5pt]">
                  <thead>
                    <tr className="text-left text-[8pt] uppercase tracking-wider text-zinc-500">
                      <th className="px-[4mm] py-[1.5mm] font-semibold">Material</th>
                      <th className="w-[18mm] py-[1.5mm] text-right font-semibold">Qtd.</th>
                      <th className="w-[22mm] py-[1.5mm] text-center font-semibold">Encontrado</th>
                      <th className="w-[12mm] py-[1.5mm] text-center font-semibold">OK</th>
                      <th className="w-[45mm] py-[1.5mm] pr-[4mm] font-semibold">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr key={i.material.nome} className="border-t-[0.2mm] border-zinc-200">
                        <td className="px-[4mm] py-[1.6mm]">{i.material.nome}</td>
                        <td className="py-[1.6mm] text-right font-bold tabular-nums">
                          {formatarQtd(i.quantidade)} <span className="font-normal text-zinc-500">{i.material.unidade}</span>
                        </td>
                        <td className="py-[1.6mm] text-center text-zinc-300">______</td>
                        <td className="py-[1.6mm] text-center">
                          <span className="inline-block size-[4mm] rounded-[0.6mm] border-[0.3mm] border-zinc-500 align-middle" />
                        </td>
                        <td className="py-[1.6mm] pr-[4mm] text-zinc-300">________________</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-[4mm] py-[3mm] text-[9.5pt] text-zinc-500">Conteúdo não cadastrado.</p>
              )}
              <footer className="flex gap-[6mm] border-t-[0.3mm] border-zinc-400 px-[4mm] py-[2.5mm] text-[9pt] text-zinc-600">
                <span>Conferido por: ______________________</span>
                <span>Data: ___/___/______</span>
                <span>Assinatura: ________________</span>
              </footer>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function Imprimir() {
  const [params, setParams] = useSearchParams()
  const { data: caixas = [], isLoading } = useCaixas()
  const { data: cores = [] } = useCores()

  const documento: Documento = params.get('doc') === 'lista' ? 'lista' : 'adesivos'
  const modelo: ModeloAdesivo = params.get('modelo') === 'geral' ? 'geral' : 'materiais'
  const fundo: Fundo = params.get('fundo') === 'preto' ? 'preto' : 'branco'
  const caixaParam = params.get('caixa') ?? ''
  const tipoParam = params.get('tipo') ?? ''
  const corParam = params.get('cor') ?? ''

  const precisaItens = documento === 'lista' || modelo === 'materiais'
  const { data: itensPorCaixa = new Map<string, ItemResumido[]>(), isLoading: carregandoItens } = useTodosItens(precisaItens)

  function mudar(chave: string, valor: string) {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
  }

  const tipos = useMemo(() => [...new Set(caixas.map((c) => c.nome))].sort(), [caixas])
  const selecionadas = useMemo(
    () =>
      caixas.filter((c) => {
        if (caixaParam) return c.id === caixaParam
        if (tipoParam && normalizar(c.nome) !== normalizar(tipoParam)) return false
        if (corParam && c.cor_id !== corParam) return false
        return true
      }),
    [caixas, caixaParam, tipoParam, corParam],
  )
  const caixaUnica = caixaParam ? caixas.find((c) => c.id === caixaParam) : undefined

  const porFolha = modelo === 'geral' ? 4 : 2
  const folhas = dividir(selecionadas, porFolha)
  const { ref, escala } = useEscala(210)

  return (
    <div className="flex flex-col gap-5">
      <div className="nao-imprimir flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold">Imprimir</h1>
            <p className="text-sm text-zinc-500">
              No iPad: toque em Imprimir e, na tela de impressão, use “Salvar em Arquivos” para gerar o PDF.
            </p>
          </div>
          <Botao
            variante="primario"
            tamanho="lg"
            icone={<Printer className="size-5" />}
            disabled={!selecionadas.length}
            onClick={() => window.print()}
          >
            Imprimir / PDF
          </Botao>
        </div>

        <div className="cartao grid gap-4 p-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="rotulo">Documento</span>
            <Segmentado
              className="w-full"
              valor={documento}
              aoMudar={(v) => mudar('doc', v === 'lista' ? 'lista' : '')}
              opcoes={[
                { valor: 'adesivos', rotulo: 'Adesivos' },
                { valor: 'lista', rotulo: 'Lista de conferência' },
              ]}
            />
          </div>
          {documento === 'adesivos' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="rotulo">Modelo</span>
                <Segmentado
                  className="w-full"
                  valor={modelo}
                  aoMudar={(v) => mudar('modelo', v === 'geral' ? 'geral' : '')}
                  opcoes={[
                    { valor: 'materiais', rotulo: 'Com materiais' },
                    { valor: 'geral', rotulo: 'Geral' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="rotulo">Fundo</span>
                <Segmentado
                  className="w-full"
                  valor={fundo}
                  aoMudar={(v) => mudar('fundo', v === 'preto' ? 'preto' : '')}
                  opcoes={[
                    { valor: 'branco', rotulo: 'Branco' },
                    { valor: 'preto', rotulo: 'Preto' },
                  ]}
                />
              </div>
            </div>
          )}
          {caixaUnica ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3 md:col-span-2 dark:bg-zinc-800">
              <span className="text-sm">
                Só a caixa <strong>{caixaUnica.numero} · {caixaUnica.nome}</strong>
              </span>
              <Botao tamanho="sm" icone={<X className="size-4" />} onClick={() => mudar('caixa', '')}>
                Todas
              </Botao>
            </div>
          ) : (
            <>
              <Campo rotulo="Tipo">
                <select className="campo" value={tipoParam} onChange={(e) => mudar('tipo', e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {tipos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Cor">
                <select className="campo" value={corParam} onChange={(e) => mudar('cor', e.target.value)}>
                  <option value="">Todas as cores</option>
                  {cores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}
        </div>
        <p className="rotulo">
          {selecionadas.length} {selecionadas.length === 1 ? 'caixa' : 'caixas'}
          {documento === 'adesivos' && selecionadas.length > 0 && ` · ${folhas.length} ${folhas.length === 1 ? 'folha A4' : 'folhas A4'}`}
        </p>
      </div>

      {isLoading || (precisaItens && carregandoItens) ? (
        <Carregando />
      ) : !selecionadas.length ? (
        <Vazio titulo="Nenhuma caixa selecionada" />
      ) : (
        <div ref={ref} className="area-impressao overflow-hidden">
          <div className="previa-zoom" style={{ zoom: escala }}>
            {documento === 'lista' ? (
              <ListaConferencia caixas={selecionadas} itensPorCaixa={itensPorCaixa} />
            ) : (
              folhas.map((folha, i) => (
                <div key={i} className="folha">
                  <div
                    className={cn(
                      'grid h-full content-start gap-[4mm]',
                      modelo === 'geral' ? 'grid-cols-[93mm_93mm]' : 'grid-cols-1',
                    )}
                  >
                    {folha.map((c) =>
                      modelo === 'geral' ? (
                        <AdesivoGeral key={c.id} caixa={c} fundo={fundo} />
                      ) : (
                        <AdesivoMateriais key={c.id} caixa={c} itens={itensPorCaixa.get(c.id) ?? []} fundo={fundo} />
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
