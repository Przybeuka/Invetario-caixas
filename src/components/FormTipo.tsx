import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { atualizarCaixas, useAcao, useCores, type DadosCaixa } from '../lib/api'
import type { Grupo } from '../lib/grupos'
import type { Tamanho } from '../lib/tipos'
import { cn } from '../lib/util'
import { Modal } from './Modal'
import { Botao, Campo, Ponto, Segmentado } from './ui'

/** Edita de uma vez todas as caixas de um tipo (nome, cor, tamanho e foto do modelo). */
export function FormTipo({ aberto, aoFechar, grupo }: { aberto: boolean; aoFechar: () => void; grupo: Grupo }) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Editar tipo"
      subtitulo={`As mudanças valem para as ${grupo.caixas.length} caixas "${grupo.nome}".`}
      largura="max-w-2xl"
      rodape={
        <div className="flex justify-end gap-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-tipo">
            Salvar
          </Botao>
        </div>
      }
    >
      <Conteudo grupo={grupo} aoFechar={aoFechar} />
    </Modal>
  )
}

function unico<T>(valores: T[]): T | undefined {
  const s = new Set(valores)
  return s.size === 1 ? valores[0] : undefined
}

function Conteudo({ grupo, aoFechar }: { grupo: Grupo; aoFechar: () => void }) {
  const navigate = useNavigate()
  const { data: cores = [] } = useCores()
  const inicial = {
    nome: grupo.nome,
    cor_id: unico(grupo.caixas.map((c) => c.cor_id)),
    tamanho: unico(grupo.caixas.map((c) => c.tamanho)),
    foto_modelo: unico(grupo.caixas.map((c) => c.foto_modelo)),
  }
  const [nome, setNome] = useState(inicial.nome)
  const [corId, setCorId] = useState<string | null | undefined>(inicial.cor_id)
  const [tamanho, setTamanho] = useState<Tamanho | null | undefined>(inicial.tamanho)

  const salvar = useAcao(async () => {
    const campos: Partial<DadosCaixa> = {}
    if (nome.trim() && nome.trim() !== inicial.nome) campos.nome = nome.trim()
    if (corId !== undefined && corId !== inicial.cor_id) campos.cor_id = corId
    if (tamanho !== undefined && tamanho !== inicial.tamanho) campos.tamanho = tamanho
    if (inicial.foto_modelo !== null) campos.foto_modelo = null
    if (!Object.keys(campos).length) return 0
    return atualizarCaixas(
      grupo.caixas.map((c) => c.id),
      campos,
    )
  }, (n) => (n ? `${n} caixas atualizadas.` : 'Nada mudou.'))

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (salvar.isPending) return
    salvar.mutate(undefined, {
      onSuccess: () => {
        aoFechar()
        if (nome.trim() && nome.trim() !== inicial.nome) navigate(`/tipo/${encodeURIComponent(nome.trim())}`, { replace: true })
      },
    })
  }


  return (
    <form id="form-tipo" onSubmit={enviar} className="flex flex-col gap-5">
      <Campo rotulo="Nome do tipo">
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Cor de todas as caixas</span>
        <div className="flex flex-wrap gap-2">
          {cores.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCorId(c.id)}
              aria-pressed={corId === c.id}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold uppercase tracking-wider transition',
                corId === c.id
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-300 hover:border-zinc-500 dark:border-zinc-700',
              )}
            >
              <Ponto hex={c.hex} className="size-4" />
              {c.nome}
            </button>
          ))}
        </div>
        {inicial.cor_id === undefined && corId === undefined && (
          <span className="text-xs text-zinc-500">As caixas têm cores diferentes. Escolha uma para unificar.</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Tamanho de todas as caixas</span>
        <Segmentado
          className="w-full"
          valor={tamanho === undefined ? 'manter' : tamanho ?? 'nenhum'}
          aoMudar={(v) => setTamanho(v === 'manter' ? undefined : v === 'nenhum' ? null : (v as Tamanho))}
          opcoes={[
            ...(inicial.tamanho === undefined ? [{ valor: 'manter', rotulo: 'Manter' }] : []),
            { valor: 'nenhum', rotulo: 'A informar' },
            { valor: 'pequena', rotulo: 'Pequena' },
            { valor: 'media', rotulo: 'Média' },
            { valor: 'grande', rotulo: 'Grande' },
          ]}
        />
      </div>

    </form>
  )
}
