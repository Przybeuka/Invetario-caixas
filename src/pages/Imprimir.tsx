import { ClipboardCheck, Package, Printer, Sticker, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QR } from '../components/QR'
import { Botao, Campo, Carregando, Vazio } from '../components/ui'
import { imagemDaCaixa } from '../lib/grupos'
import { useCaixas, useCores, useTodosItens, type ItemResumido } from '../lib/api'
import { urlFoto } from '../lib/supabase'
import type { CaixaResumo } from '../lib/tipos'
import { cn, corTexto, formatarDecimal, formatarQtd, normalizar, ROTULO_TAMANHO, volumeM3 } from '../lib/util'

type Documento = 'ficha' | 'adesivo'

const DOCUMENTOS: { valor: Documento; titulo: string; texto: string; icone: typeof Printer }[] = [
  {
    valor: 'ficha',
    titulo: 'Ficha de conferência',
    texto: 'PDF com a lista de materiais para marcar na hora de conferir.',
    icone: ClipboardCheck,
  },
  {
    valor: 'adesivo',
    titulo: 'Adesivo com materiais',
    texto: 'Folha A4 para colar na caixa, com fotos dos materiais e QR code.',
    icone: Sticker,
  },
]

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

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

function fotoDoItem(i: ItemResumido): string | null {
  const f = [...(i.material.fotos ?? [])].sort((a, b) => a.ordem - b.ordem)[0]
  return f ? urlFoto(f.caminho_miniatura) : null
}

function dimensoes(c: CaixaResumo): string | null {
  if (!c.comprimento_cm || !c.largura_cm || !c.altura_cm) return null
  return `${formatarDecimal(c.comprimento_cm)} × ${formatarDecimal(c.largura_cm)} × ${formatarDecimal(c.altura_cm)} cm`
}

function especificacoes(c: CaixaResumo): { rotulo: string; valor: string }[] {
  const v = volumeM3(c)
  return [
    { rotulo: 'Cor', valor: c.cor_nome ?? '' },
    { rotulo: 'Tamanho', valor: c.tamanho ? ROTULO_TAMANHO[c.tamanho] : '' },
    { rotulo: 'Dimensões (C × L × A)', valor: dimensoes(c) ?? '' },
    { rotulo: 'Volume', valor: v ? `${formatarDecimal(v, 4)} m³` : '' },
    { rotulo: 'Peso', valor: c.peso_kg ? `${formatarDecimal(c.peso_kg)} kg` : '' },
    { rotulo: 'Local', valor: c.local ?? '' },
  ].filter((e) => e.valor)
}

function Miniatura({ src, className, tamanho }: { src: string | null; className?: string; tamanho?: string }) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-zinc-100', className)}
      style={tamanho ? { width: tamanho, height: tamanho } : undefined}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Package className="size-1/2 text-zinc-300" strokeWidth={1.25} />
      )}
    </div>
  )
}

function ImagemCaixa({ caixa, className }: { caixa: CaixaResumo; className?: string }) {
  const img = imagemDaCaixa(caixa)
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-[2mm] bg-zinc-100', className)}>
      {img ? (
        <img
          src={img.grande}
          alt=""
          className={cn('size-full', img.origem === 'modelo' ? 'object-contain p-[2mm]' : 'object-cover')}
        />
      ) : (
        <Package className="size-1/2 text-zinc-300" strokeWidth={1.25} />
      )}
    </div>
  )
}

function CodigoQR({ caixa, className }: { caixa: CaixaResumo; className?: string }) {
  return <QR texto={`${window.location.origin}/caixas/${caixa.id}`} className={cn('shrink-0 text-black', className)} />
}

function Caixinha() {
  return <span className="inline-block size-[4.5mm] rounded-[0.8mm] border-[0.35mm] border-zinc-700 align-middle" />
}

// ---------------------------------------------------------------------------
// Ficha de conferência
// ---------------------------------------------------------------------------

function FichaConferencia({ caixa, itens }: { caixa: CaixaResumo; itens: ItemResumido[] }) {
  const hex = caixa.cor_hex ?? '#71717a'
  const specs = especificacoes(caixa)
  const total = itens.reduce((s, i) => s + i.quantidade, 0)
  return (
    <div className="folha folha-fluida quebra-pagina flex flex-col text-zinc-950">
      <header className="flex gap-[6mm] border-b-[0.6mm] border-zinc-900 pb-[4mm]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[8.5pt] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Ficha de conferência · {caixa.nome}
          </div>
          <div className="mt-[1.5mm] flex items-center gap-[3mm]">
            <span className="h-[13mm] w-[2.2mm] rounded-full" style={{ background: hex }} />
            <span className="font-display text-[38pt] font-bold leading-none">Caixa {caixa.numero}</span>
          </div>
          <dl className="mt-[3mm] grid grid-cols-[1fr_1fr_1.6fr] gap-x-[5mm] gap-y-[2mm]">
            {specs.map((e) => (
              <div key={e.rotulo} className="min-w-0">
                <dt className="text-[7pt] font-semibold uppercase tracking-[0.15em] text-zinc-500">{e.rotulo}</dt>
                <dd className="text-[10pt] font-semibold leading-tight tabular-nums">{e.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[2mm]">
          <ImagemCaixa caixa={caixa} className="h-[34mm] w-[46mm]" />
          <div className="flex items-center gap-[2mm] text-right text-[6.5pt] leading-tight text-zinc-500">
            Lista sempre
            <br />
            atualizada
            <CodigoQR caixa={caixa} className="w-[13mm]" />
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between py-[3mm] text-[8.5pt] font-semibold uppercase tracking-[0.15em] text-zinc-600">
        <span>
          {itens.length} {itens.length === 1 ? 'material' : 'materiais'} · {formatarQtd(total)}{' '}
          {total === 1 ? 'unidade' : 'unidades'}
        </span>
        <span>Marque ✓ quando conferir</span>
      </div>

      {itens.length ? (
        <table className="w-full border-collapse text-[9.5pt]">
          <thead>
            <tr className="bg-zinc-900 text-left text-[7.5pt] uppercase tracking-[0.12em] text-white">
              <th className="w-[8mm] py-[2mm] pl-[2.5mm] font-semibold">#</th>
              <th className="w-[13mm] py-[2mm] font-semibold">Foto</th>
              <th className="py-[2mm] pl-[3mm] font-semibold">Material</th>
              <th className="w-[20mm] py-[2mm] pr-[3mm] text-right font-semibold">Qtd.</th>
              <th className="w-[22mm] py-[2mm] text-center font-semibold">Encontrado</th>
              <th className="w-[11mm] py-[2mm] text-center font-semibold">✓</th>
              <th className="w-[38mm] py-[2mm] pr-[2.5mm] font-semibold">Observação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i, n) => (
              <tr key={`${i.material.nome}-${n}`} className="break-inside-avoid border-b-[0.2mm] border-zinc-300 even:bg-zinc-50">
                <td className="py-[1mm] pl-[2.5mm] align-middle text-[8pt] tabular-nums text-zinc-500">{n + 1}</td>
                <td className="py-[1mm] align-middle">
                  <Miniatura src={fotoDoItem(i)} className="size-[10mm] rounded-[1mm]" />
                </td>
                <td className="py-[1mm] pl-[3mm] align-middle font-medium uppercase leading-snug">{i.material.nome}</td>
                <td className="py-[1mm] pr-[3mm] text-right align-middle tabular-nums">
                  <span className="text-[11pt] font-bold">{formatarQtd(i.quantidade)}</span>{' '}
                  <span className="text-[8pt] text-zinc-500">{i.material.unidade}</span>
                </td>
                <td className="py-[1mm] align-middle">
                  <span className="mx-auto block h-[6mm] w-[15mm] border-b-[0.3mm] border-zinc-400" />
                </td>
                <td className="py-[1mm] text-center align-middle">
                  <Caixinha />
                </td>
                <td className="py-[1mm] pr-[2.5mm] align-middle">
                  <span className="block h-[6mm] border-b-[0.3mm] border-zinc-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rounded-[2mm] border-[0.3mm] border-dashed border-zinc-400 p-[6mm] text-center text-[10pt] text-zinc-500">
          Nenhum material cadastrado nesta caixa.
        </p>
      )}

      <section className="mt-[5mm] break-inside-avoid rounded-[2mm] border-[0.35mm] border-zinc-500 p-[4mm] text-[9pt]">
        <div className="flex flex-wrap items-center gap-x-[8mm] gap-y-[2mm]">
          <span className="text-[7.5pt] font-bold uppercase tracking-[0.15em] text-zinc-500">Resultado</span>
          <span className="flex items-center gap-[2mm]">
            <Caixinha /> Completa
          </span>
          <span className="flex items-center gap-[2mm]">
            <Caixinha /> Com pendência
          </span>
          <span className="flex items-center gap-[2mm]">
            <Caixinha /> Lacrada
          </span>
        </div>
        <div className="mt-[4mm] text-[7.5pt] font-bold uppercase tracking-[0.15em] text-zinc-500">Observações gerais</div>
        <div className="mt-[1mm] h-[6mm] border-b-[0.3mm] border-zinc-300" />
        <div className="h-[6mm] border-b-[0.3mm] border-zinc-300" />
        <div className="mt-[5mm] grid grid-cols-[1.4fr_0.8fr_1.2fr] gap-[5mm]">
          {['Conferido por', 'Data', 'Assinatura'].map((r) => (
            <div key={r}>
              <div className="h-[7mm] border-b-[0.35mm] border-zinc-700" />
              <div className="mt-[1mm] text-[7.5pt] uppercase tracking-[0.12em] text-zinc-500">{r}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Adesivo com materiais
// ---------------------------------------------------------------------------

function densidade(n: number) {
  if (n <= 8) return { colunas: 2, foto: '22mm', fonte: '11pt', qtd: '16pt', limite: 8, fotos: true }
  if (n <= 12) return { colunas: 2, foto: '16mm', fonte: '10pt', qtd: '14pt', limite: 12, fotos: true }
  if (n <= 21) return { colunas: 3, foto: '13mm', fonte: '8.5pt', qtd: '12pt', limite: 21, fotos: true }
  return { colunas: 3, foto: '0', fonte: '8.5pt', qtd: '10pt', limite: 54, fotos: false }
}

function AdesivoMateriais({ caixa, itens }: { caixa: CaixaResumo; itens: ItemResumido[] }) {
  const hex = caixa.cor_hex ?? '#71717a'
  const texto = corTexto(hex)
  const d = densidade(itens.length)
  const visiveis = itens.slice(0, d.limite)
  const sobra = itens.length - visiveis.length
  const v = volumeM3(caixa)
  const medidas = [
    { rotulo: 'Dimensões (C × L × A)', valor: dimensoes(caixa) },
    { rotulo: 'Volume', valor: v ? `${formatarDecimal(v, 4)} m³` : null },
    { rotulo: 'Peso', valor: caixa.peso_kg ? `${formatarDecimal(caixa.peso_kg)} kg` : null },
  ].filter((m): m is { rotulo: string; valor: string } => !!m.valor)

  return (
    <div className="folha flex flex-col overflow-hidden text-zinc-950">
      <div className="flex h-full flex-col overflow-hidden rounded-[4mm] border-[0.5mm] border-zinc-900">
        <div
          className="flex h-[12mm] shrink-0 items-center justify-between px-[6mm] text-[12pt] font-bold uppercase tracking-[0.25em]"
          style={{ background: hex, color: texto }}
        >
          <span>{caixa.cor_nome ?? 'Sem cor'}</span>
          {caixa.tamanho && <span>{ROTULO_TAMANHO[caixa.tamanho]}</span>}
        </div>

        <div className="flex shrink-0 gap-[6mm] p-[6mm] pb-[4mm]">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-end gap-[4mm]">
              <span className="font-display text-[96pt] font-bold leading-[0.8] tabular-nums">{caixa.numero}</span>
              <span className="pb-[2mm] text-[9pt] font-bold uppercase tracking-[0.3em] text-zinc-500">Caixa</span>
            </div>
            <div className="mt-[3mm] font-display text-[30pt] font-bold uppercase leading-[0.95]">{caixa.nome}</div>
            {medidas.length > 0 && (
              <dl className="mt-[4mm] flex flex-wrap gap-x-[7mm] gap-y-[2mm] rounded-[2mm] bg-zinc-100 px-[4mm] py-[2.5mm]">
                {medidas.map((m) => (
                  <div key={m.rotulo}>
                    <dt className="text-[7pt] font-semibold uppercase tracking-[0.15em] text-zinc-500">{m.rotulo}</dt>
                    <dd className="text-[12pt] font-bold tabular-nums">{m.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <ImagemCaixa caixa={caixa} className="h-[50mm] w-[64mm] self-start" />
        </div>

        <div className="flex shrink-0 items-center gap-[3mm] px-[6mm] pb-[2.5mm]">
          <span className="text-[9pt] font-bold uppercase tracking-[0.25em]">Conteúdo</span>
          <span className="h-[0.3mm] flex-1 bg-zinc-300" />
          <span className="text-[9pt] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-[6mm]">
          {itens.length ? (
            <ul
              className="grid gap-[2.5mm]"
              style={{ gridTemplateColumns: `repeat(${d.colunas}, minmax(0, 1fr))` }}
            >
              {visiveis.map((i, n) => (
                <li
                  key={`${i.material.nome}-${n}`}
                  className={cn(
                    'flex items-center gap-[2.5mm] rounded-[2mm] border-[0.3mm] border-zinc-300',
                    d.fotos ? 'p-[1.8mm]' : 'px-[2.5mm] py-[1mm]',
                  )}
                >
                  {d.fotos && (
                    <Miniatura src={fotoDoItem(i)} tamanho={d.foto} className="rounded-[1.2mm]" />
                  )}
                  <span
                    className="line-clamp-3 min-w-0 flex-1 font-semibold uppercase leading-[1.2]"
                    style={{ fontSize: d.fonte }}
                  >
                    {i.material.nome}
                  </span>
                  <span
                    className="flex shrink-0 flex-col items-center rounded-[1.5mm] bg-zinc-900 px-[2mm] py-[0.8mm] leading-none text-white"
                    style={{ minWidth: d.fotos ? '11mm' : '8mm' }}
                  >
                    <span className="font-display font-bold tabular-nums" style={{ fontSize: d.qtd }}>
                      {formatarQtd(i.quantidade)}
                    </span>
                    {d.fotos && <span className="text-[6pt] uppercase tracking-wider opacity-70">{i.material.unidade}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[2mm] border-[0.3mm] border-dashed border-zinc-400 p-[6mm] text-center text-[10pt] text-zinc-500">
              Nenhum material cadastrado nesta caixa.
            </p>
          )}
          {sobra > 0 && (
            <p className="mt-[2mm] text-[9pt] font-semibold text-zinc-600">
              + {sobra} {sobra === 1 ? 'item' : 'itens'} — lista completa pelo QR code.
            </p>
          )}
        </div>

        <div className="mt-[3mm] flex shrink-0 items-center gap-[4mm] border-t-[0.3mm] border-zinc-300 px-[6mm] py-[4mm]">
          <CodigoQR caixa={caixa} className="w-[24mm]" />
          <div className="text-[9pt] leading-snug">
            <div className="font-bold uppercase tracking-[0.15em]">Aponte a câmera</div>
            <div className="text-zinc-600">para ver o conteúdo atualizado, as fotos e a última conferência.</div>
          </div>
          <div className="ml-auto text-right text-[7.5pt] uppercase tracking-[0.15em] text-zinc-400">
            Inventário de caixas
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function Imprimir() {
  const [params, setParams] = useSearchParams()
  const { data: caixas = [], isLoading } = useCaixas()
  const { data: cores = [] } = useCores()
  const { data: itensPorCaixa = new Map<string, ItemResumido[]>(), isLoading: carregandoItens } = useTodosItens()

  const documento: Documento = params.get('doc') === 'adesivo' ? 'adesivo' : 'ficha'
  const caixaParam = params.get('caixa') ?? ''
  const tipoParam = params.get('tipo') ?? ''
  const corParam = params.get('cor') ?? ''

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
  const { ref, escala } = useEscala(210)

  return (
    <div className="flex flex-col gap-5">
      <div className="nao-imprimir flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold">Imprimir</h1>
            <p className="text-sm text-zinc-500">
              No iPad: toque em Imprimir / PDF e, na tela de impressão, use “Salvar em Arquivos”.
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

        <div className="grid gap-3 sm:grid-cols-2">
          {DOCUMENTOS.map((d) => {
            const ativo = documento === d.valor
            const Icone = d.icone
            return (
              <button
                key={d.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => mudar('doc', d.valor === 'adesivo' ? 'adesivo' : '')}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99]',
                  ativo
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600',
                )}
              >
                <Icone className="mt-0.5 size-6 shrink-0" />
                <span>
                  <span className="block font-display text-xl font-bold uppercase leading-tight tracking-wide">
                    {d.titulo}
                  </span>
                  <span className={cn('mt-0.5 block text-sm', ativo ? 'opacity-75' : 'text-zinc-500')}>{d.texto}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="cartao grid gap-4 p-4 md:grid-cols-2">
          {caixaUnica ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3 md:col-span-2 dark:bg-zinc-800">
              <span className="text-sm">
                Só a caixa{' '}
                <strong>
                  {caixaUnica.numero} · {caixaUnica.nome}
                </strong>
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
          {selecionadas.length > 0 &&
            (documento === 'adesivo'
              ? ` · ${selecionadas.length} ${selecionadas.length === 1 ? 'folha A4' : 'folhas A4'}`
              : ' · uma ficha por caixa')}
        </p>
      </div>

      {isLoading || carregandoItens ? (
        <Carregando />
      ) : !selecionadas.length ? (
        <Vazio titulo="Nenhuma caixa selecionada" />
      ) : (
        <div ref={ref} className="area-impressao overflow-hidden">
          <div className="previa-zoom" style={{ zoom: escala }}>
            {selecionadas.map((c) => {
              const itens = itensPorCaixa.get(c.id) ?? []
              return documento === 'ficha' ? (
                <FichaConferencia key={c.id} caixa={c} itens={itens} />
              ) : (
                <AdesivoMateriais key={c.id} caixa={c} itens={itens} />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
