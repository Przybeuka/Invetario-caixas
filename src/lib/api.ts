import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAvisos } from '../components/avisos'
import { prepararImagem } from './imagens'
import { BUCKET_FOTOS, supabase } from './supabase'
import type {
  CaixaItem,
  CaixaResumo,
  Conferencia,
  Configuracoes,
  Cor,
  Foto,
  Material,
  MaterialResumo,
  Papel,
  Perfil,
  RegistroHistorico,
  Tamanho,
  UsoMaterial,
} from './tipos'
import { mensagemErro } from './util'

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

// Sem os tipos gerados do banco, o supabase-js deduz formatos genéricos;
// aqui o formato real de cada consulta é informado em obter<T>().
type Resposta = PromiseLike<{ data: unknown; error: unknown }>

async function obter<T = unknown>(consulta: Resposta): Promise<T> {
  const { data, error } = await consulta
  if (error) throw error
  return data as T
}

/** Com RLS, alterar/excluir sem permissão não dá erro: só não afeta nenhuma linha. */
async function alterar(consulta: Resposta): Promise<number> {
  const linhas = await obter<{ id: string }[] | null>(consulta)
  if (!linhas?.length) throw new Error('Nada foi alterado. Você pode não ter permissão para isso.')
  return linhas.length
}

/**
 * Os arquivos das fotos são mantidos no armazenamento mesmo depois de excluir a foto,
 * para que "Desfazer" no histórico consiga trazê-la de volta.
 */
async function removerArquivos(_caminhos: string[]) {}

/** Executa uma ação, atualiza os dados da tela e mostra o aviso. */
export function useAcao<A, R = unknown>(
  funcao: (args: A) => Promise<R>,
  sucesso?: string | ((resultado: R, args: A) => string | null),
) {
  const qc = useQueryClient()
  const { avisar } = useAvisos()
  return useMutation({
    mutationFn: funcao,
    onSuccess: async (resultado, args) => {
      await qc.invalidateQueries()
      const texto = typeof sucesso === 'function' ? sucesso(resultado, args) : sucesso
      if (texto) avisar(texto)
    },
    onError: (erro) => avisar(mensagemErro(erro), 'erro'),
  })
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export const useCores = () =>
  useQuery({
    queryKey: ['cores'],
    queryFn: () => obter<Cor[]>(supabase.from('cores').select('*').order('ordem').order('nome')),
    staleTime: 5 * 60_000,
  })

export const useConfig = () =>
  useQuery({
    queryKey: ['config'],
    queryFn: () =>
      obter<Configuracoes>(supabase.from('configuracoes').select('validade_conferencia_dias').eq('id', 1).single()),
    staleTime: 5 * 60_000,
  })

/** Validade da conferência em dias (0 = não vence). */
export function useValidade(): number {
  return useConfig().data?.validade_conferencia_dias ?? 30
}

export const useCaixas = () =>
  useQuery({
    queryKey: ['caixas'],
    queryFn: () => obter<CaixaResumo[]>(supabase.from('v_caixas').select('*').order('numero')),
  })

export const useItens = (caixaId: string | undefined) =>
  useQuery({
    queryKey: ['itens', caixaId],
    enabled: !!caixaId,
    queryFn: async () => {
      const itens = await obter<CaixaItem[]>(
        supabase
          .from('caixa_itens')
          .select(
            'id, caixa_id, material_id, quantidade, observacao, criado_em, material:materiais(id, nome, unidade, categoria, fotos(caminho_miniatura, ordem))',
          )
          .eq('caixa_id', caixaId as string),
      )
      return itens.sort((a, b) => a.material.nome.localeCompare(b.material.nome, 'pt-BR'))
    },
  })

export interface ItemResumido {
  caixa_id: string
  quantidade: number
  material: {
    nome: string
    unidade: string
    fotos: { caminho_miniatura: string; ordem: number }[] | null
  }
  /** Modelo 3D, quando o material é "CAIXA <cor>" (preenchido na impressão). */
  modelo?: string | null
}

/** Conteúdo de todas as caixas (para impressão). */
export const useTodosItens = (ativo = true) =>
  useQuery({
    queryKey: ['todos-itens'],
    enabled: ativo,
    queryFn: async () => {
      const itens = await todasLinhas<ItemResumido>(
        'caixa_itens',
        'id, caixa_id, quantidade, material:materiais(nome, unidade, fotos(caminho_miniatura, ordem))',
      )
      const porCaixa = new Map<string, ItemResumido[]>()
      for (const i of itens) {
        const lista = porCaixa.get(i.caixa_id)
        if (lista) lista.push(i)
        else porCaixa.set(i.caixa_id, [i])
      }
      for (const lista of porCaixa.values())
        lista.sort((a, b) => a.material.nome.localeCompare(b.material.nome, 'pt-BR'))
      return porCaixa
    },
  })

export type DonoFoto = { caixa_id: string } | { material_id: string }

export const useFotos = (dono: DonoFoto | null) => {
  const coluna = dono && 'caixa_id' in dono ? 'caixa_id' : 'material_id'
  const id = dono ? ('caixa_id' in dono ? dono.caixa_id : dono.material_id) : ''
  return useQuery({
    queryKey: ['fotos', coluna, id],
    enabled: !!dono,
    queryFn: () => obter<Foto[]>(supabase.from('fotos').select('*').eq(coluna, id).order('ordem').order('criado_em')),
  })
}

export const useConferencias = (caixaId: string | undefined) =>
  useQuery({
    queryKey: ['conferencias', caixaId],
    enabled: !!caixaId,
    queryFn: () =>
      obter<Conferencia[]>(
        supabase
          .from('conferencias')
          .select(
            'id, caixa_id, status, observacao, conferido_em, conferido_por_nome, itens:conferencia_itens(id, material_id, material_nome, quantidade_esperada, quantidade_encontrada, observacao)',
          )
          .eq('caixa_id', caixaId as string)
          .order('conferido_em', { ascending: false })
          .limit(20),
      ),
  })

export const useMateriais = () =>
  useQuery({
    queryKey: ['materiais'],
    queryFn: () => obter<MaterialResumo[]>(supabase.from('v_materiais').select('*').order('nome')),
  })

export const useUsoMaterial = (materialId: string | undefined) =>
  useQuery({
    queryKey: ['uso-material', materialId],
    enabled: !!materialId,
    queryFn: async () => {
      const usos = await obter<UsoMaterial[]>(
        supabase
          .from('caixa_itens')
          .select('id, quantidade, observacao, caixa:caixas(id, numero, nome, cor:cores(nome, hex))')
          .eq('material_id', materialId as string),
      )
      return usos.sort((a, b) => a.caixa.numero - b.caixa.numero)
    },
  })

export const usePerfis = (ativo = true) =>
  useQuery({
    queryKey: ['perfis'],
    enabled: ativo,
    queryFn: () => obter<Perfil[]>(supabase.from('perfis').select('*').order('criado_em')),
  })

export async function desfazerHistorico(id: number) {
  return obter<string>(supabase.rpc('desfazer_historico', { p_id: id }))
}

export interface FiltroHistorico {
  tabela: string
  busca: string
}

const POR_PAGINA = 40

export const useHistorico = (filtro: FiltroHistorico) =>
  useInfiniteQuery({
    queryKey: ['historico', filtro],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let consulta = supabase
        .from('historico')
        .select('id, tabela, registro_id, acao, resumo, antes, depois, usuario_nome, criado_em')
        .order('id', { ascending: false })
        .range(pageParam, pageParam + POR_PAGINA - 1)
      if (filtro.tabela) consulta = consulta.eq('tabela', filtro.tabela)
      const termo = filtro.busca.trim()
      if (termo) consulta = consulta.ilike('resumo', `%${termo.replace(/[%_]/g, '')}%`)
      return obter<RegistroHistorico[]>(consulta)
    },
    getNextPageParam: (ultima, todas) => (ultima.length < POR_PAGINA ? undefined : todas.length * POR_PAGINA),
  })

// ---------------------------------------------------------------------------
// Caixas
// ---------------------------------------------------------------------------

export interface DadosCaixa {
  nome: string
  cor_id: string | null
  tamanho: Tamanho | null
  local: string | null
  observacoes: string | null
  foto_modelo: string | null
  peso_kg?: number | null
  comprimento_cm?: number | null
  largura_cm?: number | null
  altura_cm?: number | null
}

export async function criarCaixas(dados: DadosCaixa, numeros: number[], copiarDe: string | null) {
  const criadas = await obter<{ id: string; numero: number }[]>(
    supabase
      .from('caixas')
      .insert(numeros.map((numero) => ({ ...dados, numero })))
      .select('id, numero'),
  )
  if (copiarDe && criadas.length) {
    await obter(
      supabase.rpc('copiar_conteudo', {
        p_origem: copiarDe,
        p_destinos: criadas.map((c) => c.id),
        p_substituir: false,
      }),
    )
  }
  return criadas.sort((a, b) => a.numero - b.numero)
}

export async function atualizarCaixas(ids: string[], campos: Partial<DadosCaixa> & { numero?: number }) {
  return alterar(supabase.from('caixas').update(campos).in('id', ids).select('id'))
}

export async function excluirCaixa(id: string) {
  const fotos = await obter<Pick<Foto, 'caminho' | 'caminho_miniatura'>[]>(
    supabase.from('fotos').select('caminho, caminho_miniatura').eq('caixa_id', id),
  )
  await alterar(supabase.from('caixas').delete().eq('id', id).select('id'))
  await removerArquivos(fotos.flatMap((f) => [f.caminho, f.caminho_miniatura]))
}

export async function copiarConteudo(origem: string, destinos: string[], substituir: boolean) {
  return obter<number>(
    supabase.rpc('copiar_conteudo', {
      p_origem: origem,
      p_destinos: destinos,
      p_substituir: substituir,
    }),
  )
}

// ---------------------------------------------------------------------------
// Conteúdo das caixas
// ---------------------------------------------------------------------------

export async function adicionarItem(args: {
  caixa_id: string
  material_id: string
  quantidade: number
  observacao?: string | null
}) {
  await obter(
    supabase
      .from('caixa_itens')
      .insert({ ...args, observacao: args.observacao?.trim() || null })
      .select('id'),
  )
}

export async function atualizarItem(id: string, campos: { quantidade?: number; observacao?: string | null }) {
  return alterar(supabase.from('caixa_itens').update(campos).eq('id', id).select('id'))
}

export async function removerItem(id: string) {
  return alterar(supabase.from('caixa_itens').delete().eq('id', id).select('id'))
}

// ---------------------------------------------------------------------------
// Materiais
// ---------------------------------------------------------------------------

export interface DadosMaterial {
  nome: string
  unidade: string
  categoria: string | null
  descricao: string | null
}

export async function criarMaterial(dados: DadosMaterial) {
  return obter<Material>(supabase.from('materiais').insert(dados).select('*').single())
}

export async function atualizarMaterial(id: string, campos: Partial<DadosMaterial>) {
  return alterar(supabase.from('materiais').update(campos).eq('id', id).select('id'))
}

export async function excluirMaterial(id: string) {
  const fotos = await obter<Pick<Foto, 'caminho' | 'caminho_miniatura'>[]>(
    supabase.from('fotos').select('caminho, caminho_miniatura').eq('material_id', id),
  )
  await alterar(supabase.from('materiais').delete().eq('id', id).select('id'))
  await removerArquivos(fotos.flatMap((f) => [f.caminho, f.caminho_miniatura]))
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function enviarFotos(arquivos: File[], dono: DonoFoto, aoProgredir?: (feitos: number) => void) {
  const pasta = 'caixa_id' in dono ? `caixas/${dono.caixa_id}` : `materiais/${dono.material_id}`
  const armazenamento = supabase.storage.from(BUCKET_FOTOS)
  let feitos = 0
  for (const arquivo of arquivos) {
    const { grande, miniatura } = await prepararImagem(arquivo)
    const base = `${pasta}/${crypto.randomUUID()}`
    const caminho = `${base}.jpg`
    const caminho_miniatura = `${base}_min.jpg`
    const opcoes = { contentType: 'image/jpeg', cacheControl: '31536000' }
    const r1 = await armazenamento.upload(caminho, grande, opcoes)
    if (r1.error) throw r1.error
    const r2 = await armazenamento.upload(caminho_miniatura, miniatura, opcoes)
    if (r2.error) throw r2.error
    await obter(
      supabase
        .from('fotos')
        .insert({ ...dono, caminho, caminho_miniatura })
        .select('id'),
    )
    feitos += 1
    aoProgredir?.(feitos)
  }
}

export interface FotoExistente {
  caminho: string
  caminho_miniatura: string
  rotulo: string
}

/** Todas as fotos já enviadas (sem repetir o mesmo arquivo), com o nome de quem as usa. */
export const useFotosExistentes = (ativo: boolean) =>
  useQuery({
    queryKey: ['fotos-existentes'],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: async () => {
      const linhas = await obter<
        {
          caminho: string
          caminho_miniatura: string
          caixa: { numero: number; nome: string } | null
          material: { nome: string } | null
        }[]
      >(
        supabase
          .from('fotos')
          .select('caminho, caminho_miniatura, caixa:caixas(numero, nome), material:materiais(nome)')
          .order('criado_em', { ascending: false }),
      )
      const vistos = new Map<string, FotoExistente>()
      for (const f of linhas) {
        if (vistos.has(f.caminho)) continue
        vistos.set(f.caminho, {
          caminho: f.caminho,
          caminho_miniatura: f.caminho_miniatura,
          rotulo: f.caixa ? `Caixa ${f.caixa.numero} · ${f.caixa.nome}` : (f.material?.nome ?? ''),
        })
      }
      return [...vistos.values()]
    },
  })

/** Usa fotos que já estão no sistema (sem reenviar o arquivo). */
export async function vincularFotos(fotos: FotoExistente[], dono: DonoFoto) {
  if (!fotos.length) return
  await obter(
    supabase
      .from('fotos')
      .insert(
        fotos.map((f) => ({
          ...dono,
          caminho: f.caminho,
          caminho_miniatura: f.caminho_miniatura,
        })),
      )
      .select('id'),
  )
}

export async function excluirFoto(foto: Foto) {
  await alterar(supabase.from('fotos').delete().eq('id', foto.id).select('id'))
  await removerArquivos([foto.caminho, foto.caminho_miniatura])
}

export async function definirCapa(foto: Foto, todas: Foto[]) {
  const menor = Math.min(0, ...todas.map((f) => f.ordem))
  return alterar(
    supabase
      .from('fotos')
      .update({ ordem: menor - 1 })
      .eq('id', foto.id)
      .select('id'),
  )
}

// ---------------------------------------------------------------------------
// Conferência
// ---------------------------------------------------------------------------

export interface ItemConferido {
  material_id: string | null
  material_nome: string
  quantidade_esperada: number
  quantidade_encontrada: number
  observacao: string | null
}

export async function registrarConferencia(args: {
  caixaId: string
  itens: ItemConferido[]
  observacao: string
  pendencia: boolean
}) {
  return obter<string>(
    supabase.rpc('registrar_conferencia', {
      p_caixa_id: args.caixaId,
      p_itens: args.itens,
      p_observacao: args.observacao,
      p_pendencia: args.pendencia,
    }),
  )
}

export async function excluirConferencia(id: string) {
  return alterar(supabase.from('conferencias').delete().eq('id', id).select('id'))
}

// ---------------------------------------------------------------------------
// Usuários, cores e configurações
// ---------------------------------------------------------------------------

export async function atualizarPerfil(id: string, campos: { nome?: string; papel?: Papel }) {
  return alterar(supabase.from('perfis').update(campos).eq('id', id).select('id'))
}

export async function salvarConfig(config: Configuracoes) {
  return alterar(supabase.from('configuracoes').update(config).eq('id', 1).select('id'))
}

export async function salvarCor(cor: {
  id?: string
  nome: string
  hex: string
  foto_modelo: string | null
  ordem: number
}) {
  const { id, ...campos } = cor
  if (id) return alterar(supabase.from('cores').update(campos).eq('id', id).select('id'))
  await obter(supabase.from('cores').insert(campos).select('id'))
  return 1
}

export async function excluirCor(id: string) {
  return alterar(supabase.from('cores').delete().eq('id', id).select('id'))
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

async function todasLinhas<T = Record<string, unknown>>(tabela: string, colunas = '*'): Promise<T[]> {
  const linhas: T[] = []
  for (let inicio = 0; ; inicio += 1000) {
    const parte = await obter<T[]>(
      supabase
        .from(tabela)
        .select(colunas)
        .order('id')
        .range(inicio, inicio + 999),
    )
    linhas.push(...parte)
    if (parte.length < 1000) break
  }
  return linhas
}

export async function gerarBackup() {
  const tabelas = [
    'configuracoes',
    'cores',
    'caixas',
    'materiais',
    'caixa_itens',
    'fotos',
    'conferencias',
    'conferencia_itens',
  ]
  const dados: Record<string, Record<string, unknown>[]> = {}
  for (const tabela of tabelas) dados[tabela] = await todasLinhas(tabela)
  return { gerado_em: new Date().toISOString(), versao: 1, ...dados }
}

export interface LinhaPlanilha {
  quantidade: number
  observacao: string | null
  caixa: {
    numero: number
    nome: string
    tamanho: string | null
    local: string | null
    cor: { nome: string } | null
  }
  material: { nome: string; unidade: string; categoria: string | null }
}

export async function linhasPlanilha() {
  const linhas = await todasLinhas<LinhaPlanilha>(
    'caixa_itens',
    'id, quantidade, observacao, caixa:caixas(numero, nome, tamanho, local, cor:cores(nome)), material:materiais(nome, unidade, categoria)',
  )
  return linhas.sort(
    (a, b) => a.caixa.numero - b.caixa.numero || a.material.nome.localeCompare(b.material.nome, 'pt-BR'),
  )
}
