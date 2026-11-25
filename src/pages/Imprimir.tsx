import { ClipboardCheck, Download, Package, Printer, Sticker, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QR } from '../components/QR'
import { Botao, Campo, Carregando, Vazio } from '../components/ui'
import { imagemDaCaixa } from '../lib/grupos'
import { modeloDoMaterial, ordenarMateriais } from '../lib/materiaisCaixa'
import { srcModelo } from '../lib/modelos'
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

/** Gera um PDF com uma página de 130 × 250 mm por adesivo (tamanho exato, sem A4). */
async function gerarPdfAdesivos(area: HTMLElement, nomeArquivo: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const paginas = Array.from(area.querySelectorAll<HTMLElement>('.adesivo-pagina'))
  if (!paginas.length) return
  const pdf = new jsPDF({ unit: 'mm', format: [ADESIVO.largura, ADESIVO.altura], orientation: 'portrait', compress: true })
  for (let i = 0; i < paginas.length; i++) {
    const canvas = await html2canvas(paginas[i], {
      scale: 4,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone: (doc) => {
        doc.querySelectorAll<HTMLElement>('.previa-zoom').forEach((e) => (e.style.zoom = '1'))
        doc.querySelectorAll<HTMLElement>('.adesivo-pagina').forEach((e) => {
          e.style.margin = '0'
          e.style.boxShadow = 'none'
        })
      },
    })
    if (i > 0) pdf.addPage([ADESIVO.largura, ADESIVO.altura], 'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, ADESIVO.largura, ADESIVO.altura, undefined, 'FAST')
  }
  pdf.save(nomeArquivo)
}

/** Reduz a prévia para caber na tela sem afetar a impressão. */
/** Gera o relatório (ficha de conferência) em PDF A4, uma ficha por caixa; fichas longas seguem na página seguinte. */
async function gerarPdfFichas(area: HTMLElement, nomeArquivo: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const fichas = Array.from(area.querySelectorAll<HTMLElement>('.folha'))
  if (!fichas.length) return
  const L = 210
  const A = 297
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  let primeira = true
  for (const ficha of fichas) {
    const canvas = await html2canvas(ficha, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone: (doc) => {
        doc.querySelectorAll<HTMLElement>('.previa-zoom').forEach((e) => (e.style.zoom = '1'))
        doc.querySelectorAll<HTMLElement>('.folha').forEach((e) => {
          e.style.margin = '0'
          e.style.boxShadow = 'none'
        })
      },
    })
    const altTotalMm = (canvas.height / canvas.width) * L
    const paginas = Math.max(1, Math.ceil(altTotalMm / A - 0.01))
    const pxPorPagina = Math.round((A / L) * canvas.width)
    for (let n = 0; n < paginas; n++) {
      const fatia = document.createElement('canvas')
      fatia.width = canvas.width
      fatia.height = Math.min(pxPorPagina, canvas.height - n * pxPorPagina)
      const ctx = fatia.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, fatia.width, fatia.height)
      ctx.drawImage(canvas, 0, n * pxPorPagina, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height)
      if (!primeira) pdf.addPage('a4', 'portrait')
      primeira = false
      pdf.addImage(fatia.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, L, (fatia.height / fatia.width) * L, undefined, 'FAST')
    }
  }
  pdf.save(nomeArquivo)
}

function useEscala(larguraMm: number) {
  // ref por callback: a prévia só existe depois do carregamento, então o observador precisa esperar o elemento aparecer.
  const [el, ref] = useState<HTMLDivElement | null>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    if (!el) return
    const larguraPx = (larguraMm / 25.4) * 96
    const medir = () => setEscala(Math.min(1, el.clientWidth / larguraPx))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [el, larguraMm])
  return { ref, el, escala }
}

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

function fotoDoItem(i: ItemResumido): string | null {
  if (i.modelo) return srcModelo(i.modelo)
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
        <img src={src} alt="" className={cn('size-full', src.startsWith('/modelos/') ? 'object-contain' : 'object-cover')} />
      ) : (
        <Package className="size-1/2 text-zinc-300" strokeWidth={1.25} />
      )}
    </div>
  )
}

function ImagemCaixa({ caixa, className, tamanho }: { caixa: CaixaResumo; className?: string; tamanho?: string }) {
  const img = imagemDaCaixa(caixa)
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-[2mm] bg-zinc-100', className)}
      style={tamanho ? { width: tamanho, height: tamanho } : undefined}
    >
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
  // Fotos maiores quando há poucos materiais; reduz para a ficha continuar numa página só.
  const fotoMm = itens.length <= 6 ? 18 : itens.length <= 8 ? 15 : itens.length <= 10 ? 12.5 : 11
  const fotoCaixaMm = itens.length <= 8 ? 44 : 38
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
          <ImagemCaixa caixa={caixa} tamanho={`${fotoCaixaMm}mm`} />
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
              <th className="py-[2mm] font-semibold" style={{ width: `${fotoMm + 4}mm` }}>Foto</th>
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
                <td className="py-[0.6mm] pl-[2.5mm] align-middle text-[8pt] tabular-nums text-zinc-500">{n + 1}</td>
                <td className="py-[0.6mm] align-middle">
                  <Miniatura src={fotoDoItem(i)} className="rounded-[1.2mm]" tamanho={`${fotoMm}mm`} />
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
// Adesivo com materiais (130 × 250 mm, página do tamanho exato do adesivo)
// ---------------------------------------------------------------------------

const ADESIVO = { largura: 130, altura: 250, margem: 5 }
/** Altura útil para a grade de materiais (mm), descontado cabeçalho e medidas. */
const ALTURA_GRADE = 182
/** Altura fixa do painel de medidas, para a área dos materiais ser sempre a mesma. */
const ALTURA_PAINEL = 22

type Linha = { k: number; lado: number; nl: number; fonte: number; qtd: string; itens: ItemResumido[] }

/**
 * Distribui os materiais em linhas que ocupam sempre a largura toda (mesmo alinhamento lateral).
 * As linhas podem ter quantidades diferentes (ex.: 3·4·4 ou 2·3·3·3); as linhas com menos itens
 * ficam no topo e têm fotos maiores. Escolhe a combinação que mais preenche a altura do adesivo.
 */
function distribuir(itens: ItemResumido[]) {
  const gap = 1.8
  const util = ADESIVO.largura - ADESIVO.margem * 2
  const fonte = (k: number) => (k <= 2 ? 10.5 : k === 3 ? 8.8 : k === 4 ? 7.4 : 6.4)
  const lado = (k: number) => (util - gap * (Math.max(k, 2) - 1)) / Math.max(k, 2)
  const linhaMm = (k: number) => fonte(k) * 0.3528 * 1.12
  const precisa = (k: number, nomes: string[]) => {
    const cpl = Math.max(4, Math.floor(lado(k) / (fonte(k) * 0.3528 * 0.76)))
    return Math.min(3, Math.max(1, ...nomes.map((t) => Math.ceil((t.length + 3) / cpl))))
  }
  const n = itens.length
  if (!n) return { linhas: [] as Linha[], gap, sobra: 0 }

  // Testa de 1 até n linhas (quantidades por linha diferindo no máximo 1). Se a combinação passar da altura,
  // as fotos encolhem por igual e as linhas mantêm as pontas alinhadas (sobra vira espaço entre as fotos).
  // Fica a combinação com a maior área total de fotos.
  let melhor: { linhas: Linha[]; altura: number; area: number } | null = null
  // Quantidade que se divide em linhas iguais (ex.: 9 = 3·3·3): só linhas iguais.
  // Número primo (ex.: 7, 11): linhas que diferem no máximo 1 item (ex.: 3·4, 3·4·4), menores em cima.
  const primo = n > 3 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0)
  const combinacoes: number[][] = []
  if (!primo) for (let k = 1; k <= 6; k++) if (n % k === 0 && (k > 1 || n <= 2)) combinacoes.push(Array(n / k).fill(k))
  const gerar = (resta: number, min: number, atual: number[]) => {
    if (!resta) return void combinacoes.push(atual)
    for (let k = min; k <= Math.min(6, resta); k++) if (!atual.length || k - atual[0] <= 1) gerar(resta - k, k, [...atual, k])
  }
  if (primo || !combinacoes.length) gerar(n, 2, [])
  if (!combinacoes.length) gerar(n, 1, [])
  for (const ks of combinacoes) {
    const r = ks.length
    for (const reduzir of [false, true]) {
      let pos = 0
      const linhas: Linha[] = ks.map((k) => {
        const grupo = itens.slice(pos, (pos += k))
        const p = precisa(k, grupo.map((i) => i.material.nome))
        return {
          k,
          lado: lado(k),
          nl: reduzir ? Math.min(2, p) : p,
          fonte: fonte(k),
          qtd: k <= 2 ? '11pt' : k === 3 ? '9.5pt' : k === 4 ? '8pt' : '7pt',
          itens: grupo,
        }
      })
      const legendas = linhas.reduce((s, l) => s + linhaMm(l.k) * l.nl + 1, 0) + gap * (r - 1)
      const fotos = linhas.reduce((s, l) => s + l.lado, 0)
      const escala = Math.min(1, (ALTURA_GRADE - legendas) / fotos)
      if (escala <= 0) continue
      linhas.forEach((l) => (l.lado *= escala))
      const area = linhas.reduce((s, l) => s + l.itens.length * l.lado * l.lado, 0)
      // nomes com menos linhas só se ganharem bastante área
      const nota = reduzir ? area * 0.92 : area
      if (Math.min(...linhas.map((l) => l.lado)) >= 14 && (!melhor || nota > melhor.area))
        melhor = { linhas, altura: legendas + fotos * escala, area: nota }
    }
  }
  if (!melhor) {
    // Não cabe: 6 por linha e o resto vai para o QR code.
    const linhas: Linha[] = []
    let usado = 0
    for (let pos = 0; pos < n; pos += 6) {
      const h = lado(6) + linhaMm(6) * 2 + 1 + (linhas.length ? gap : 0)
      if (usado + h > ALTURA_GRADE) break
      usado += h
      linhas.push({ k: 6, lado: lado(6), nl: 2, fonte: fonte(6), qtd: '7pt', itens: itens.slice(pos, pos + 6) })
    }
    melhor = { linhas, altura: usado, area: 0 }
  }
  const mostrados = melhor.linhas.reduce((s, l) => s + l.itens.length, 0)
  return { linhas: melhor.linhas, gap, sobra: n - mostrados }
}

function CartaoMaterial({ item, l }: { item: ItemResumido; l: Linha }) {
  const src = fotoDoItem(item)
  // Mais de uma unidade: efeito leve de cartas sobrepostas (cópias da mesma foto atrás, para baixo e à direita).
  const pilha = Number(item.quantidade) >= 2
  const recuo = pilha ? Math.max(0.9, l.lado * 0.03) : 0
  const foto = l.lado - recuo * 2
  const conteudo = src ? (
    <img src={src} alt="" className={cn('absolute inset-0 size-full', src.startsWith('/modelos/') ? 'object-contain' : 'object-cover')} />
  ) : (
    <Package className="absolute left-1/2 top-1/2 size-[35%] -translate-x-1/2 -translate-y-1/2 text-zinc-300" strokeWidth={1.25} />
  )
  const carta = 'absolute overflow-hidden rounded-[1.8mm] border-[0.3mm] border-zinc-300 bg-zinc-100'
  return (
    <li className="flex min-w-0 flex-col" style={{ width: `${l.lado}mm` }}>
      <div className="relative" style={{ width: `${l.lado}mm`, height: `${l.lado}mm` }}>
        {pilha &&
          [2, 1].map((n) => (
            <div
              key={n}
              className={cn(carta, 'border-white')}
              style={{ width: `${foto}mm`, height: `${foto}mm`, left: `${recuo * n}mm`, top: `${recuo * n}mm`, filter: `brightness(${1 - n * 0.12})` }}
            >
              {conteudo}
            </div>
          ))}
        <div className={cn(carta, pilha && 'border-white shadow-[0_0.3mm_0.8mm_rgba(0,0,0,0.25)]')} style={{ width: `${foto}mm`, height: `${foto}mm`, left: 0, top: 0 }}>
          {conteudo}
          <span
            className="absolute right-[1.2mm] top-[1.2mm] flex items-baseline gap-[0.6mm] rounded-[1.2mm] border-[0.45mm] border-black bg-white px-[1.4mm] py-[0.3mm] font-display font-bold leading-none text-black tabular-nums"
            style={{ fontSize: l.qtd }}
          >
            {formatarQtd(item.quantidade)}
            {item.material.unidade !== 'un' && <span className="text-[0.55em] font-semibold uppercase">{item.material.unidade}</span>}
          </span>
        </div>
      </div>
      <span
        className="pt-[1mm] font-bold uppercase leading-[1.12]"
        style={{
          fontSize: `${l.fonte}pt`,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: l.nl,
          overflow: 'hidden',
        }}
      >
        {item.material.nome}
      </span>
    </li>
  )
}

function AdesivoMateriais({ caixa, itens }: { caixa: CaixaResumo; itens: ItemResumido[] }) {
  const hex = caixa.cor_hex ?? '#71717a'
  const { linhas, gap, sobra } = distribuir(itens)
  const v = volumeM3(caixa)
  const medidas = [
    { rotulo: 'Dimensões (C × L × Alt.)', valor: dimensoes(caixa), largo: true },
    { rotulo: 'Volume', valor: v ? `${formatarDecimal(v, 4)} m³` : null, largo: false },
  ].filter((m): m is { rotulo: string; valor: string; largo: boolean } => !!m.valor)

  return (
    <div
      className="adesivo-pagina flex flex-col overflow-hidden bg-white text-zinc-950"
      style={{ width: `${ADESIVO.largura}mm`, height: `${ADESIVO.altura}mm`, padding: `${ADESIVO.margem}mm` }}
    >
      <>
        <span className="-mx-[5mm] -mt-[5mm] mb-[3mm] h-[2.5mm] shrink-0" style={{ background: hex }} />

        <div className="flex shrink-0 items-end gap-[3mm]">
          <div className="flex min-w-0 flex-1 flex-col justify-end">
            <span className="font-display text-[66pt] font-bold leading-[0.78] tabular-nums">{caixa.numero}</span>
            <span className="mt-[2mm] font-display text-[15pt] font-bold uppercase leading-[1.05]">
              Caixa {caixa.nome}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-center justify-end gap-[0.8mm]">
            <CodigoQR caixa={caixa} className="w-[18mm]" />
            <span className="text-[5pt] font-semibold uppercase tracking-[0.12em] text-zinc-500">Ver conteúdo</span>
          </div>
          <ImagemCaixa caixa={caixa} className="size-[30mm]" />
        </div>

        <div data-painel className="mt-[2.5mm] flex shrink-0 items-stretch gap-[3mm] rounded-[2mm] bg-zinc-100 p-[2.5mm]" style={{ height: `${ALTURA_PAINEL}mm` }}>
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
            <div className="flex shrink-0 flex-col justify-center border-l-[0.3mm] border-zinc-300 pl-[4mm] pr-[1mm]">
              <span className="text-[9pt] font-bold uppercase tracking-[0.2em] text-zinc-600">Peso</span>
              <span className="font-display text-[36pt] font-bold uppercase leading-[0.9] tabular-nums">
                {formatarDecimal(caixa.peso_kg)}
                <span className="ml-[1mm] text-[18pt]">kg</span>
              </span>
            </div>
          ) : null}
        </div>

        <div data-grade className="mt-[2.5mm] min-h-0 flex-1 overflow-hidden">
          {itens.length ? (
            <div className="flex flex-col" style={{ gap: `${gap}mm` }}>
              {linhas.map((l, li) => (
                <ul key={li} className={cn('flex', l.k === 1 ? 'justify-center' : 'justify-between')}>
                  {l.itens.map((i, n) => (
                    <CartaoMaterial key={`${i.material.nome}-${n}`} item={i} l={l} />
                  ))}
                </ul>
              ))}
            </div>
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
      </>
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
  const { ref, el: areaEl, escala } = useEscala(documento === 'adesivo' ? ADESIVO.largura : 210)
  const [gerando, setGerando] = useState(false)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  async function salvarPdf() {
    if (!areaEl) return
    setGerando(true)
    setErroPdf(null)
    try {
      const sufixo = caixaUnica ? `caixa-${caixaUnica.numero}` : tipoParam ? normalizar(tipoParam).replace(/\s+/g, '-') : 'caixas'
      if (documento === 'adesivo') await gerarPdfAdesivos(areaEl, `adesivos-${sufixo}.pdf`)
      else await gerarPdfFichas(areaEl, `relatorio-conferencia-${sufixo}.pdf`)
    } catch {
      setErroPdf('Não foi possível gerar o PDF. Tente novamente em instantes.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {documento === 'adesivo' && (
        <style>{`@media print { @page { size: ${ADESIVO.largura}mm ${ADESIVO.altura}mm; margin: 0; } }`}</style>
      )}
      <div className="nao-imprimir flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold">Imprimir</h1>
            <p className="text-sm text-zinc-500">
              {documento === 'adesivo'
                ? 'Gerar relatório cria um PDF com uma página de 13 × 25 cm por adesivo.'
                : 'Gerar relatório cria um PDF A4 com uma ficha de conferência por caixa.'}
            </p>
            {erroPdf && <p className="mt-1 text-sm font-semibold text-red-600">{erroPdf}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao
              variante="primario"
              tamanho="lg"
              icone={<Download className="size-5" />}
              disabled={!selecionadas.length || gerando}
              onClick={salvarPdf}
            >
              {gerando ? 'Gerando…' : 'Gerar relatório'}
            </Botao>
          </div>
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
              ? ` · ${selecionadas.length} ${selecionadas.length === 1 ? 'adesivo' : 'adesivos'} de 13 × 25 cm`
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
              const itens = ordenarMateriais(itensPorCaixa.get(c.id) ?? [], (i) => i.material.nome, cores).map((i) => ({
                ...i,
                modelo: modeloDoMaterial(i.material.nome, cores, c.tamanho),
              }))
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
