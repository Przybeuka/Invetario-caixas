/** Fotos de referência das caixas (pasta public/modelos). */
export interface FotoModelo {
  id: string
  cor: string
  rotulo: string
}

export const MODELOS: FotoModelo[] = [
  { id: 'caqui-1', cor: 'Caqui', rotulo: 'Caqui' },
  { id: 'azul-1', cor: 'Azul', rotulo: 'Azul · média' },
  { id: 'azul-2', cor: 'Azul', rotulo: 'Azul · comprida' },
  { id: 'azul-3', cor: 'Azul', rotulo: 'Azul · alta' },
  { id: 'vermelha-1', cor: 'Vermelha', rotulo: 'Vermelha' },
  { id: 'amarela-1', cor: 'Amarela', rotulo: 'Amarela' },
  { id: 'preta-1', cor: 'Preta', rotulo: 'Preta · média' },
  { id: 'preta-2', cor: 'Preta', rotulo: 'Preta · comprida' },
  { id: 'preta-3', cor: 'Preta', rotulo: 'Preta · alta' },
]

export function srcModelo(id: string, grande = false): string {
  return `/modelos/${id}${grande ? '' : '_min'}.jpg`
}
