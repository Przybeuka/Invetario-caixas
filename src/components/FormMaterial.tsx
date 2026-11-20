import { useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { atualizarMaterial, criarMaterial, enviarFotos, useMateriais, type DadosMaterial } from '../lib/api'
import type { Material } from '../lib/tipos'
import { mensagemErro, normalizar, UNIDADES } from '../lib/util'
import { useAvisos } from './avisos'
import { Modal } from './Modal'
import { Botao, Campo } from './ui'

export function FormMaterial({
  aberto,
  aoFechar,
  material,
  nomeInicial,
  aoCriar,
}: {
  aberto: boolean
  aoFechar: () => void
  material?: Material
  nomeInicial?: string
  aoCriar?: (m: Material) => void
}) {
  const [salvando, setSalvando] = useState(false)
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={material ? 'Editar material' : 'Novo material'}
      largura="max-w-xl"
      protegido
      rodape={
        <div className="flex justify-end gap-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-material" carregando={salvando}>
            {material ? 'Salvar' : 'Criar material'}
          </Botao>
        </div>
      }
    >
      <ConteudoMaterial
        material={material}
        nomeInicial={nomeInicial}
        aoFechar={aoFechar}
        aoCriar={aoCriar}
        setSalvando={setSalvando}
      />
    </Modal>
  )
}

export function CamposMaterial({
  dados,
  setDados,
  autoFocus,
}: {
  dados: DadosMaterial
  setDados: (d: DadosMaterial) => void
  autoFocus?: boolean
}) {
  const { data: materiais = [] } = useMateriais()
  const categorias = useMemo(
    () => [...new Set(materiais.map((m) => m.categoria).filter((c): c is string => !!c))].sort(),
    [materiais],
  )
  return (
    <>
      <Campo rotulo="Nome">
        <input
          className="campo"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
          placeholder="Ex.: Cone de sinalização"
          required
          autoFocus={autoFocus}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Unidade">
          <input
            className="campo"
            value={dados.unidade}
            onChange={(e) => setDados({ ...dados, unidade: e.target.value })}
            list="unidades"
            required
          />
          <datalist id="unidades">
            {UNIDADES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Categoria (opcional)">
          <input
            className="campo"
            value={dados.categoria ?? ''}
            onChange={(e) => setDados({ ...dados, categoria: e.target.value })}
            list="categorias"
            placeholder="Ex.: Sinalização"
          />
          <datalist id="categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
      </div>
      <Campo rotulo="Descrição (opcional)">
        <textarea
          className="campo min-h-20"
          rows={2}
          value={dados.descricao ?? ''}
          onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
          placeholder="Modelo, medidas, cuidados…"
        />
      </Campo>
    </>
  )
}

export function limparDadosMaterial(d: DadosMaterial): DadosMaterial {
  return {
    nome: d.nome.trim(),
    unidade: d.unidade.trim() || 'un',
    categoria: d.categoria?.trim() || null,
    descricao: d.descricao?.trim() || null,
  }
}

function ConteudoMaterial({
  material,
  nomeInicial,
  aoFechar,
  aoCriar,
  setSalvando,
}: {
  material?: Material
  nomeInicial?: string
  aoFechar: () => void
  aoCriar?: (m: Material) => void
  setSalvando: (v: boolean) => void
}) {
  const [dados, setDados] = useState<DadosMaterial>({
    nome: material?.nome ?? nomeInicial ?? '',
    unidade: material?.unidade ?? 'un',
    categoria: material?.categoria ?? '',
    descricao: material?.descricao ?? '',
  })
  const [arquivos, setArquivos] = useState<File[]>([])
  const entrada = useRef<HTMLInputElement>(null)
  const { data: materiais = [] } = useMateriais()
  const { avisar } = useAvisos()
  const qc = useQueryClient()

  const duplicado = materiais.find(
    (m) => m.id !== material?.id && normalizar(m.nome) === normalizar(dados.nome) && dados.nome.trim(),
  )

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (duplicado) return
    setSalvando(true)
    try {
      const limpos = limparDadosMaterial(dados)
      if (material) {
        await atualizarMaterial(material.id, limpos)
        avisar('Material atualizado.')
      } else {
        const novo = await criarMaterial(limpos)
        if (arquivos.length) await enviarFotos(arquivos, { material_id: novo.id })
        avisar('Material criado.')
        aoCriar?.(novo)
      }
      await qc.invalidateQueries()
      aoFechar()
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form id="form-material" onSubmit={enviar} className="flex flex-col gap-4">
      <CamposMaterial dados={dados} setDados={setDados} autoFocus={!material} />
      {duplicado && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Já existe o material “{duplicado.nome}”. Use o existente para não duplicar.
        </p>
      )}
      {!material && (
        <div className="flex flex-col gap-1.5">
          <span className="rotulo">Fotos (opcional)</span>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          />
          <div className="flex items-center gap-3">
            <Botao icone={<Camera className="size-4" />} onClick={() => entrada.current?.click()}>
              {arquivos.length ? 'Trocar fotos' : 'Escolher fotos'}
            </Botao>
            {arquivos.length > 0 && (
              <span className="text-sm text-zinc-500">
                {arquivos.length} {arquivos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
              </span>
            )}
          </div>
        </div>
      )}
    </form>
  )
}
