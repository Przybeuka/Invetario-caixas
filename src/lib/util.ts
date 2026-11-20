import type { EstadoCaixa, StatusConferencia, Tamanho } from './tipos'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Minúsculas, sem acentos e com espaços simples — para buscar e agrupar. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

const fmtQtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
export const formatarQtd = (n: number | string | null | undefined) => fmtQtd.format(Number(n ?? 0))

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const formatarData = (iso: string) => fmtData.format(new Date(iso))
export const formatarDataCurta = (iso: string) => fmtDataCurta.format(new Date(iso))
export const formatarHora = (iso: string) => fmtHora.format(new Date(iso))
export const formatarDataHora = (iso: string) => `${formatarData(iso)} às ${formatarHora(iso)}`

export const DIA_MS = 86_400_000

export function tempoRelativo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.round(dias / 30)
  if (meses < 12) return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
  const anos = Math.round(dias / 365)
  return anos <= 1 ? 'há 1 ano' : `há ${anos} anos`
}

export function estadoConferencia(
  status: StatusConferencia | null,
  conferidoEm: string | null,
  validadeDias: number,
): EstadoCaixa {
  if (!status || !conferidoEm) return 'nunca'
  if (status === 'pendencia') return 'pendencia'
  if (validadeDias > 0 && Date.now() - new Date(conferidoEm).getTime() > validadeDias * DIA_MS) return 'vencida'
  return 'ok'
}

/** Menor = mais urgente. */
export const PRIORIDADE_ESTADO: Record<EstadoCaixa, number> = { pendencia: 0, nunca: 1, vencida: 2, ok: 3 }

export const ROTULO_TAMANHO: Record<Tamanho, string> = { pequena: 'Pequena', media: 'Média', grande: 'Grande' }

/** Número decimal digitado (aceita vírgula). Vazio ou inválido → null. */
export function lerDecimal(texto: string): number | null {
  const n = Number.parseFloat(texto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatarDecimal(n: number | null | undefined, casas = 2): string {
  if (n == null) return ''
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

/** Volume em m³ a partir das medidas em cm. */
export function volumeM3(c: { comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null }): number | null {
  if (!c.comprimento_cm || !c.largura_cm || !c.altura_cm) return null
  return (c.comprimento_cm * c.largura_cm * c.altura_cm) / 1_000_000
}

export const UNIDADES = ['un', 'par', 'kit', 'jogo', 'm', 'rolo', 'pacote', 'caixa', 'L', 'kg']

/** Texto preto ou branco, o que tiver mais contraste com a cor de fundo. */
export function corTexto(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return '#ffffff'
  const n = Number.parseInt(m[1], 16)
  const canal = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
  return lum > 0.4 ? '#18181b' : '#ffffff'
}

export function plural(n: number, singular: string, varios: string): string {
  return `${formatarQtd(n)} ${n === 1 ? singular : varios}`
}

export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  const primeira = partes[0][0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

export function mensagemErro(erro: unknown): string {
  const e = erro as { code?: string; message?: string } | null
  const msg = e?.message ?? String(erro ?? 'Erro desconhecido')
  if (e?.code === '23505') {
    if (msg.includes('caixas_numero_key')) return 'Já existe uma caixa com esse número.'
    if (msg.includes('materiais_nome_unico')) return 'Já existe um material com esse nome.'
    if (msg.includes('caixa_itens_caixa_id_material_id_key')) return 'Esse material já está na caixa.'
    if (msg.includes('cores_nome_key')) return 'Já existe uma cor com esse nome.'
    return 'Esse registro já existe.'
  }
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'Você não tem permissão para isso.'
  if (e?.code === '23503') return 'Este item está em uso e não pode ser removido.'
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg))
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'
  if (/already registered|already been registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar".'
  if (/Password should be at least|password.*characters/i.test(msg))
    return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos.'
  if (/should be different/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/Unable to validate email|invalid format/i.test(msg)) return 'E-mail inválido.'
  if (/Signups not allowed/i.test(msg)) return 'Cadastro de novas contas está desativado.'
  return msg
}

export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
