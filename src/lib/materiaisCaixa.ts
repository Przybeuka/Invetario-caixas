import { modeloPorTamanho } from './grupos'
import type { Cor } from './tipos'
import { normalizar } from './util'

/**
 * Materiais cujo nome é "CAIXA <cor>" (ex.: CAIXA CAQUI, CAIXA AZUL) representam a própria caixa:
 * usam o modelo 3D daquela cor e ficam sempre no topo das listas.
 */

const TAMANHOS: Record<string, string> = {
  pequena: 'pequena',
  pequeno: 'pequena',
  media: 'media',
  medio: 'media',
  grande: 'grande',
}

/** "vermelha" e "vermelho" contam como a mesma cor. */
const raiz = (s: string) => s.replace(/[ao]$/, '')

/** Id do modelo 3D (ex.: 'caqui-1') quando o nome do material é "CAIXA <cor>"; senão null. */
export function modeloDoMaterial(nome: string, cores: Cor[], tamanhoCaixa?: string | null): string | null {
  const m = /^caixa\s+(.+)$/.exec(normalizar(nome))
  if (!m) return null
  const [palavra, ...resto] = m[1].split(' ')
  const cor = cores.find((c) => raiz(normalizar(c.nome)) === raiz(palavra))
  if (!cor) return null
  const doNome = resto.map((p) => TAMANHOS[p]).find(Boolean)
  return modeloPorTamanho(cor.nome, doNome ?? tamanhoCaixa ?? null) ?? cor.foto_modelo ?? null
}

/** Materiais "CAIXA <cor>" primeiro; o restante em ordem alfabética. */
export function ordenarMateriais<T>(lista: T[], nome: (t: T) => string, cores: Cor[]): T[] {
  const ehCaixa = (t: T) => (modeloDoMaterial(nome(t), cores) ? 0 : 1)
  return [...lista].sort((a, b) => ehCaixa(a) - ehCaixa(b) || nome(a).localeCompare(nome(b), 'pt-BR'))
}
