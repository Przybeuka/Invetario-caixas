import { useQueryClient } from '@tanstack/react-query'
import { unzipSync } from 'fflate'
import { CheckCircle2, FileArchive, ImageUp, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { Botao } from '../components/ui'
import { enviarFotos, type DonoFoto } from '../lib/api'
import { supabase } from '../lib/supabase'

/**
 * Importação em lote: cada arquivo se chama `caixa_<id>.jpg` ou `material_<id>.jpg`.
 * Aceita o .zip inteiro ou as imagens soltas. Quem já tem foto é pulado.
 */
const PADRAO = /(caixa|material)_([0-9a-f-]{36})\.(jpe?g|png|webp)$/i

type Linha = { nome: string; estado: 'ok' | 'pulado' | 'erro'; detalhe?: string }

async function extrair(arquivos: File[]): Promise<File[]> {
  const saida: File[] = []
  for (const a of arquivos) {
    if (/\.zip$/i.test(a.name)) {
      const conteudo = unzipSync(new Uint8Array(await a.arrayBuffer()))
      for (const [caminho, bytes] of Object.entries(conteudo)) {
        const nome = caminho.split('/').pop() ?? ''
        if (!PADRAO.test(nome) || nome.startsWith('.')) continue
        saida.push(new File([bytes.slice().buffer], nome, { type: 'image/jpeg' }))
      }
    } else if (PADRAO.test(a.name)) {
      saida.push(a)
    }
  }
  return saida
}

export function ImportarFotos() {
  const entrada = useRef<HTMLInputElement>(null)
  const cliente = useQueryClient()
  const [ocupado, setOcupado] = useState(false)
  const [total, setTotal] = useState(0)
  const [linhas, setLinhas] = useState<Linha[]>([])

  async function importar(selecionados: File[]) {
    setOcupado(true)
    setLinhas([])
    try {
      const fotos = await extrair(selecionados)
      setTotal(fotos.length)
      const { data: existentes } = await supabase.from('fotos').select('caixa_id, material_id')
      const comFoto = new Set((existentes ?? []).flatMap((f) => [f.caixa_id, f.material_id]).filter(Boolean))
      for (const f of fotos) {
        const [, tipo, id] = PADRAO.exec(f.name)!
        if (comFoto.has(id)) {
          setLinhas((l) => [...l, { nome: f.name, estado: 'pulado', detalhe: 'já tem foto' }])
          continue
        }
        const dono: DonoFoto = tipo.toLowerCase() === 'caixa' ? { caixa_id: id } : { material_id: id }
        try {
          await enviarFotos([f], dono)
          comFoto.add(id)
          setLinhas((l) => [...l, { nome: f.name, estado: 'ok' }])
        } catch (e) {
          setLinhas((l) => [...l, { nome: f.name, estado: 'erro', detalhe: e instanceof Error ? e.message : String(e) }])
        }
      }
    } finally {
      setOcupado(false)
      cliente.invalidateQueries()
    }
  }

  const feitos = linhas.length
  const ok = linhas.filter((l) => l.estado === 'ok').length
  const pulados = linhas.filter((l) => l.estado === 'pulado').length
  const erros = linhas.filter((l) => l.estado === 'erro')

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-bold">Importar fotos</h1>
        <p className="text-sm text-zinc-500">
          Selecione o arquivo .zip de fotos (ou as fotos já descompactadas). Cada foto vai direto para a caixa ou o
          material certo. Quem já tem foto é pulado, então pode repetir sem duplicar.
        </p>
      </div>

      <input
        ref={entrada}
        type="file"
        multiple
        accept=".zip,application/zip,image/*"
        className="hidden"
        onChange={(e) => {
          const lista = [...(e.target.files ?? [])]
          e.target.value = ''
          if (lista.length) void importar(lista)
        }}
      />
      <Botao
        variante="primario"
        tamanho="lg"
        icone={<FileArchive className="size-5" />}
        disabled={ocupado}
        onClick={() => entrada.current?.click()}
        className="self-start"
      >
        {ocupado ? 'Importando…' : 'Escolher .zip ou fotos'}
      </Botao>

      {total > 0 && (
        <div className="cartao flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <ImageUp className="size-5" />
            {feitos} de {total}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-zinc-900 transition-all dark:bg-white" style={{ width: `${(feitos / total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> {ok} enviadas
            </span>
            {pulados > 0 && <span className="text-zinc-500">{pulados} já tinham foto</span>}
            {erros.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <TriangleAlert className="size-4" /> {erros.length} com erro
              </span>
            )}
          </div>
          {erros.length > 0 && (
            <ul className="text-xs text-red-600">
              {erros.slice(0, 8).map((e) => (
                <li key={e.nome}>
                  {e.nome}: {e.detalhe}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
