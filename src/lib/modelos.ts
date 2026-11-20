/** Fotos de referência das caixas (pasta public/modelos). */
export interface FotoModelo {
  id: string
  cor: string
  rotulo: string
}

export const MODELOS: FotoModelo[] = [
  { id: 'caqui-1', cor: 'Caqui', rotulo: 'Caqui · grande' },
  { id: 'azul-1', cor: 'Azul', rotulo: 'Azul · média' },
  { id: 'azul-2', cor: 'Azul', rotulo: 'Azul · grande' },
  { id: 'azul-3', cor: 'Azul', rotulo: 'Azul · pequena' },
  { id: 'vermelha-1', cor: 'Vermelha', rotulo: 'Vermelha · pequena' },
  { id: 'amarela-1', cor: 'Amarela', rotulo: 'Amarela · média' },
  { id: 'preta-1', cor: 'Preta', rotulo: 'Preta · média' },
  { id: 'preta-2', cor: 'Preta', rotulo: 'Preta · grande' },
  { id: 'preta-3', cor: 'Preta', rotulo: 'Preta · pequena' },
]

export function srcModelo(id: string, grande = false): string {
  return `/modelos/${id}${grande ? '' : '_min'}.webp`
}
