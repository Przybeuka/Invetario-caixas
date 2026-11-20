import { ClipboardCheck, Package, Printer, Sticker, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QR } from '../components/QR'
import { Botao, Campo, Carregando, Vazio } from '../components/ui'
import { imagemDaCaixa } from '../lib/grupos'
import { useCaixas, useCores, useTodosItens, type ItemResumido } from '../lib/api'
import { urlFoto } from '../lib/supabase'
import type { CaixaResumo } from '../lib/tipos'
import { cn, formatarDecimal, formatarQtd, normalizar, ROTULO_TAMANHO, volumeM3 } from '../lib/util'

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
    texto: 'Adesivo 13 × 25 cm para colar na caixa, com fotos dos materiais e QR code.',
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
          className={cn('size-full', img.origem === 'modelo' ? 'object-contain' : 'object-cover')}
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
          <ImagemCaixa caixa={caixa} className="size-[36mm]" />
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
// Adesivo com materiais (130 × 250 mm, centralizado numa folha A4)
// ---------------------------------------------------------------------------

const ADESIVO = { largura: 130, altura: 250, margem: 5 }
/** Altura útil para a grade de materiais (mm), descontado cabeçalho e medidas. */
const ALTURA_GRADE = 165

function densidade(n: number) {
  const gap = 2.5
  const util = ADESIVO.largura - ADESIVO.margem * 2
  const fonte = (c: number) => (c <= 2 ? 10.5 : c === 3 ? 8.8 : c === 4 ? 7.4 : 6.4)
  // até 3 linhas de nome, mais um respiro acima
  const legenda = (c: number) => fonte(c) * 0.3528 * 1.12 * 3 + 1.4
  let colunas = 2
  for (; colunas < 6; colunas++) {
    const lado = (util - gap * (colunas - 1)) / colunas
    const linhas = Math.ceil(Math.max(1, n) / colunas)
    if (linhas * (lado + legenda(colunas)) + gap * (linhas - 1) <= ALTURA_GRADE) break
  }
  const lado = (util - gap * (colunas - 1)) / colunas
  return {
    colunas,
    gap,
    lado,
    legenda: legenda(colunas),
    nome: `${fonte(colunas)}pt`,
    qtd: colunas <= 2 ? '11pt' : colunas === 3 ? '9.5pt' : colunas === 4 ? '8pt' : '7pt',
    limite: colunas * Math.floor((ALTURA_GRADE + gap) / (lado + legenda(colunas) + gap)),
  }
}

function CartaoMaterial({ item, d }: { item: ItemResumido; d: ReturnType<typeof densidade> }) {
  const src = fotoDoItem(item)
  return (
    <li className="flex min-w-0 flex-col">
      <div
        className="relative overflow-hidden rounded-[1.8mm] border-[0.3mm] border-zinc-300 bg-zinc-100"
        style={{ width: `${d.lado}mm`, height: `${d.lado}mm` }}
      >
        {src ? (
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Package className="absolute left-1/2 top-1/2 size-[35%] -translate-x-1/2 -translate-y-1/2 text-zinc-300" strokeWidth={1.25} />
        )}
        <span
          className="absolute right-[1.2mm] top-[1.2mm] flex items-baseline gap-[0.6mm] rounded-[1.2mm] border-[0.45mm] border-black bg-white px-[1.4mm] py-[0.3mm] font-display font-bold leading-none text-black tabular-nums"
          style={{ fontSize: d.qtd }}
        >
          {formatarQtd(item.quantidade)}
          {item.material.unidade !== 'un' && (
            <span className="text-[0.55em] font-semibold uppercase">{item.material.unidade}</span>
          )}
        </span>
      </div>
      <span
        className="line-clamp-3 pt-[1.2mm] font-bold uppercase leading-[1.12]"
        style={{ fontSize: d.nome, height: `${d.legenda}mm` }}
      >
        {item.material.nome}
      </span>
    </li>
  )
}

function AdesivoMateriais({ caixa, itens }: { caixa: CaixaResumo; itens: ItemResumido[] }) {
  const hex = caixa.cor_hex ?? '#71717a'
  const d = densidade(itens.length)
  const visiveis = itens.slice(0, d.limite)
  const sobra = itens.length - visiveis.length
  const v = volumeM3(caixa)
  const medidas = [
    { rotulo: 'Dimensões (C × L × Alt.)', valor: dimensoes(caixa), largo: true },
    { rotulo: 'Volume', valor: v ? `${formatarDecimal(v, 4)} m³` : null, largo: false },
  ].filter((m): m is { rotulo: string; valor: string; largo: boolean } => !!m.valor)

  return (
    <div className="folha flex items-center justify-center text-zinc-950">
      <div
        className="flex flex-col overflow-hidden rounded-[3mm] border-[0.3mm] border-dashed border-zinc-400 bg-white"
        style={{ width: `${ADESIVO.largura}mm`, height: `${ADESIVO.altura}mm`, padding: `${ADESIVO.margem}mm` }}
      >
        <span className="-mx-[5mm] -mt-[5mm] mb-[4mm] h-[2.5mm] shrink-0" style={{ background: hex }} />

        <div className="flex shrink-0 gap-[3mm]">
          <div className="flex min-w-0 flex-1 flex-col justify-end">
            <span className="font-display text-[88pt] font-bold leading-[0.78] tabular-nums">{caixa.numero}</span>
            <span className="mt-[3mm] font-display text-[16pt] font-bold uppercase leading-[1.05]">
              Caixa {caixa.nome}
            </span>
            <span className="mt-[1mm] flex items-center gap-[1.5mm] text-[8pt] font-bold uppercase tracking-[0.18em] text-zinc-600">
              <span className="size-[3mm] rounded-full ring-[0.3mm] ring-black/20" style={{ background: hex }} />
              {[caixa.cor_nome, caixa.tamanho ? ROTULO_TAMANHO[caixa.tamanho] : null].filter(Boolean).join(' · ')}
            </span>
          </div>
          <ImagemCaixa caixa={caixa} className="size-[44mm]" />
        </div>

        <div className="mt-[3mm] flex shrink-0 items-stretch gap-[3mm] rounded-[2mm] bg-zinc-100 p-[2.5mm]">
          <dl className="flex min-w-0 flex-1 flex-col justify-center gap-[1.8mm]">
            {medidas.length ? (
              medidas.map((m) => (
                <div key={m.rotulo} className="min-w-0">
                  <dt className="text-[6pt] font-semibold uppercase tracking-[0.14em] text-zinc-500">{m.rotulo}</dt>
                  <dd className="font-display text-[12pt] font-bold uppercase leading-none tabular-nums">{m.valor}</dd>
                </div>
              ))
            ) : (
              <div className="text-[8pt] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {itens.length} {itens.length === 1 ? 'material' : 'materiais'}
              </div>
            )}
          </dl>
          {caixa.peso_kg ? (
            <div className="flex shrink-0 flex-col justify-center border-l-[0.3mm] border-zinc-300 px-[3mm]">
              <span className="text-[9pt] font-bold uppercase tracking-[0.2em] text-zinc-600">Peso</span>
              <span className="font-display text-[30pt] font-bold uppercase leading-[0.9] tabular-nums">
                {formatarDecimal(caixa.peso_kg)}
                <span className="ml-[1mm] text-[16pt]">kg</span>
              </span>
            </div>
          ) : null}
          <div className="flex shrink-0 flex-col items-center justify-center gap-[0.8mm]">
            <CodigoQR caixa={caixa} className="w-[15mm]" />
            <span className="text-[5pt] font-semibold uppercase tracking-[0.12em] text-zinc-500">Ver conteúdo</span>
          </div>
        </div>

        <div className="mt-[3mm] min-h-0 flex-1 overflow-hidden">
          {itens.length ? (
            <ul
              className="grid"
              style={{ gridTemplateColumns: `repeat(${d.colunas}, minmax(0, 1fr))`, gap: `${d.gap}mm` }}
            >
              {visiveis.map((i, n) => (
                <CartaoMaterial key={`${i.material.nome}-${n}`} item={i} d={d} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[2mm] border-[0.3mm] border-dashed border-zinc-400 p-[6mm] text-center text-[9pt] text-zinc-500">
              Nenhum material cadastrado nesta caixa.
            </p>
          )}
          {sobra > 0 && (
            <p className="mt-[1.5mm] text-[7.5pt] font-semibold text-zinc-600">
              + {sobra} {sobra === 1 ? 'item' : 'itens'} — lista completa pelo QR code.
            </p>
          )}
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
