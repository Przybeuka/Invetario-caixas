import { srcModelo } from './modelos'
import { urlFoto } from './supabase'
import type { CaixaResumo, EstadoCaixa } from './tipos'
import { estadoConferencia, normalizar, PRIORIDADE_ESTADO, ROTULO_TAMANHO } from './util'

export interface Imagem {
  src: string
  grande: string
  origem: 'foto' | 'modelo'
}

export interface CorGrupo {
  id: string | null
  nome: string
  hex: string
  ordem: number
}

/** Caixas com o mesmo nome formam um "tipo" (um cartão na home). */
export interface Grupo {
  chave: string
  nome: string
  caixas: CaixaResumo[]
  cores: CorGrupo[]
  estado: EstadoCaixa
  conferidas: number
  imagem: Imagem | null
  fotosMateriais: string[]
}

const COR_NEUTRA = '#a1a1aa'

/** Modelo 3D que combina cor + tamanho (azul e preta têm pequena, média e grande). */
const MODELO_POR_COR: Record<string, Partial<Record<string, string>>> = {
  azul: { pequena: 'azul-3', media: 'azul-1', grande: 'azul-2' },
  preta: { pequena: 'preta-3', media: 'preta-1', grande: 'preta-2' },
  caqui: { grande: 'caqui-1' },
  amarela: { media: 'amarela-1' },
  vermelha: { pequena: 'vermelha-1' },
}

export function modeloPorTamanho(cor: string | null, tamanho: string | null): string | null {
  if (!cor) return null
  const m = MODELO_POR_COR[normalizar(cor)]
  if (!m) return null
  return (tamanho && m[tamanho]) || null
}

export function imagemDaCaixa(c: CaixaResumo): Imagem | null {
  const miniatura = c.fotos_caixa?.[0]
  if (miniatura) {
    return { src: urlFoto(miniatura), grande: urlFoto(miniatura.replace(/_min\.jpg$/, '.jpg')), origem: 'foto' }
  }
  const modelo = c.foto_modelo || modeloPorTamanho(c.cor_nome, c.tamanho) || c.cor_foto_modelo
  if (modelo) return { src: srcModelo(modelo), grande: srcModelo(modelo, true), origem: 'modelo' }
  return null
}

export function estadoDaCaixa(c: CaixaResumo, validadeDias: number): EstadoCaixa {
  return estadoConferencia(c.conferencia_status, c.conferido_em, validadeDias)
}

export function piorEstado(estados: EstadoCaixa[]): EstadoCaixa {
  return estados.reduce<EstadoCaixa>(
    (pior, e) => (PRIORIDADE_ESTADO[e] < PRIORIDADE_ESTADO[pior] ? e : pior),
    'ok',
  )
}

export function agrupar(caixas: CaixaResumo[], validadeDias: number): Grupo[] {
  const mapa = new Map<string, CaixaResumo[]>()
  for (const c of caixas) {
    const chave = normalizar(c.nome)
    const lista = mapa.get(chave)
    if (lista) lista.push(c)
    else mapa.set(chave, [c])
  }

  const grupos: Grupo[] = []
  for (const [chave, lista] of mapa) {
    lista.sort((a, b) => a.numero - b.numero)
    const cores = new Map<string, CorGrupo>()
    for (const c of lista) {
      const k = c.cor_id ?? 'sem-cor'
      if (!cores.has(k)) {
        cores.set(k, {
          id: c.cor_id,
          nome: c.cor_nome ?? 'Sem cor',
          hex: c.cor_hex ?? COR_NEUTRA,
          ordem: c.cor_ordem ?? 999,
        })
      }
    }
    const estados = lista.map((c) => estadoDaCaixa(c, validadeDias))
    const comFoto = lista.find((c) => c.fotos_caixa?.length)
    grupos.push({
      chave,
      nome: lista[0].nome,
      caixas: lista,
      cores: [...cores.values()].sort((a, b) => a.ordem - b.ordem),
      estado: piorEstado(estados),
      conferidas: estados.filter((e) => e === 'ok').length,
      imagem: imagemDaCaixa(comFoto ?? lista[0]),
      fotosMateriais: [...new Set(lista.flatMap((c) => c.fotos_materiais ?? []))].slice(0, 4),
    })
  }
  return grupos.sort((a, b) => a.caixas[0].numero - b.caixas[0].numero)
}

export function resumoMateriais(lista: CaixaResumo[]): string | null {
  if (!lista.length) return null
  const qtds = lista.map((c) => c.qtd_itens)
  const menor = Math.min(...qtds)
  const maior = Math.max(...qtds)
  if (maior === 0) return null
  const sufixo = lista.length > 1 ? ' por caixa' : ''
  if (menor === maior) return `${menor} ${menor === 1 ? 'material' : 'materiais'}${sufixo}`
  return `${menor}–${maior} materiais${sufixo}`
}

export function resumoTamanho(lista: CaixaResumo[]): string | null {
  const tamanhos = new Set(lista.map((c) => c.tamanho))
  if (tamanhos.size > 1) return 'Tamanhos variados'
  const unico = [...tamanhos][0]
  return unico ? ROTULO_TAMANHO[unico] : null
}

export function combinaBusca(c: CaixaResumo, termoNormalizado: string): boolean {
  if (!termoNormalizado) return true
  if (/^\d+$/.test(termoNormalizado) && c.numero === Number(termoNormalizado)) return true
  const alvo = normalizar([c.nome, c.local, c.cor_nome, c.materiais_busca, String(c.numero)].join(' '))
  return termoNormalizado.split(' ').every((parte) => alvo.includes(parte))
}

export function corDoGrupo(g: Grupo): string {
  return g.cores[0]?.hex ?? COR_NEUTRA
}

export function linkDoGrupo(g: Grupo): string {
  return g.caixas.length === 1 ? `/caixas/${g.caixas[0].id}` : `/tipo/${encodeURIComponent(g.nome)}`
}
