export type Papel = 'pendente' | 'conferente' | 'editor' | 'admin'
export type Tamanho = 'pequena' | 'media' | 'grande'
export type StatusConferencia = 'ok' | 'pendencia'
/** Situação calculada da caixa (considera a validade da conferência). */
export type EstadoCaixa = 'ok' | 'vencida' | 'pendencia' | 'nunca'

export interface Perfil {
  id: string
  nome: string
  email: string | null
  papel: Papel
  criado_em: string
}

export interface Cor {
  id: string
  nome: string
  hex: string
  foto_modelo: string | null
  ordem: number
}

export interface Configuracoes {
  validade_conferencia_dias: number
}

export interface CaixaResumo {
  id: string
  numero: number
  nome: string
  cor_id: string | null
  cor_nome: string | null
  cor_hex: string | null
  cor_ordem: number | null
  cor_foto_modelo: string | null
  tamanho: Tamanho | null
  local: string | null
  observacoes: string | null
  foto_modelo: string | null
  criado_em: string
  atualizado_em: string
  qtd_itens: number
  qtd_total: number
  materiais_busca: string | null
  conferencia_status: StatusConferencia | null
  conferido_em: string | null
  conferido_por_nome: string | null
  fotos_caixa: string[] | null
  fotos_materiais: string[] | null
}

export interface Material {
  id: string
  nome: string
  descricao: string | null
  categoria: string | null
  unidade: string
  criado_em: string
  atualizado_em: string
}

export interface MaterialResumo extends Material {
  qtd_caixas: number
  qtd_total: number
  fotos: string[] | null
}

export interface Foto {
  id: string
  caixa_id: string | null
  material_id: string | null
  caminho: string
  caminho_miniatura: string
  ordem: number
  criado_em: string
}

export interface CaixaItem {
  id: string
  caixa_id: string
  material_id: string
  quantidade: number
  observacao: string | null
  criado_em: string
  material: {
    id: string
    nome: string
    unidade: string
    categoria: string | null
    fotos: { caminho_miniatura: string; ordem: number }[]
  }
}

export interface UsoMaterial {
  id: string
  quantidade: number
  observacao: string | null
  caixa: {
    id: string
    numero: number
    nome: string
    cor: { nome: string; hex: string } | null
  }
}

export interface ConferenciaItem {
  id: string
  material_id: string | null
  material_nome: string
  quantidade_esperada: number
  quantidade_encontrada: number
  observacao: string | null
}

export interface Conferencia {
  id: string
  caixa_id: string
  status: StatusConferencia
  observacao: string | null
  conferido_em: string
  conferido_por_nome: string | null
  itens: ConferenciaItem[]
}

export interface RegistroHistorico {
  id: number
  tabela: string
  registro_id: string | null
  acao: 'criou' | 'alterou' | 'excluiu'
  resumo: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  usuario_nome: string | null
  criado_em: string
}
