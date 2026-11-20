import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { atualizarCaixas, criarCaixas, useAcao, useCaixas, useCores, type DadosCaixa } from '../lib/api'
import type { CaixaResumo, Tamanho } from '../lib/tipos'
import { cn, formatarDecimal, lerDecimal, normalizar, volumeM3 } from '../lib/util'
import { Modal } from './Modal'
import { modeloPorTamanho } from '../lib/grupos'
import { srcModelo } from '../lib/modelos'
import { Botao, Campo, Ponto, Segmentado } from './ui'

export interface ValoresIniciaisCaixa extends Partial<DadosCaixa> {
  numero?: number
  copiarDe?: string | null
}

export function FormCaixa({
  aberto,
  aoFechar,
  caixa,
  inicial,
}: {
  aberto: boolean
  aoFechar: () => void
  caixa?: CaixaResumo
  inicial?: ValoresIniciaisCaixa
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={caixa ? `Editar caixa ${caixa.numero}` : 'Nova caixa'}
      subtitulo={caixa ? caixa.nome : 'Crie uma ou várias caixas do mesmo tipo de uma vez.'}
      largura="max-w-2xl"
      rodape={
        <div className="flex justify-end gap-2">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-caixa">
            {caixa ? 'Salvar' : 'Criar'}
          </Botao>
        </div>
      }
    >
      <Conteudo caixa={caixa} inicial={inicial} aoFechar={aoFechar} />
    </Modal>
  )
}

const OPCOES_TAMANHO: { valor: Tamanho | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'A informar' },
  { valor: 'pequena', rotulo: 'Pequena' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'grande', rotulo: 'Grande' },
]

function Conteudo({
  caixa,
  inicial,
  aoFechar,
}: {
  caixa?: CaixaResumo
  inicial?: ValoresIniciaisCaixa
  aoFechar: () => void
}) {
  const editando = !!caixa
  const navigate = useNavigate()
  const { data: caixas = [] } = useCaixas()
  const { data: cores = [] } = useCores()

  const proximo = useMemo(() => caixas.reduce((m, c) => Math.max(m, c.numero), 0) + 1, [caixas])
  const [nome, setNome] = useState(caixa?.nome ?? inicial?.nome ?? '')
  const [numero, setNumero] = useState(String(caixa?.numero ?? inicial?.numero ?? proximo))
  const [numeroTocado, setNumeroTocado] = useState(editando || inicial?.numero !== undefined)
  const [quantidade, setQuantidade] = useState('1')
  const [corId, setCorId] = useState<string | null>(caixa?.cor_id ?? inicial?.cor_id ?? null)
  const [tamanho, setTamanho] = useState<Tamanho | ''>(caixa?.tamanho ?? inicial?.tamanho ?? '')
  const [local, setLocal] = useState(caixa?.local ?? inicial?.local ?? '')
  const [observacoes, setObservacoes] = useState(caixa?.observacoes ?? inicial?.observacoes ?? '')
  const [peso, setPeso] = useState(formatarDecimal(caixa?.peso_kg))
  const [comp, setComp] = useState(formatarDecimal(caixa?.comprimento_cm))
  const [larg, setLarg] = useState(formatarDecimal(caixa?.largura_cm))
  const [alt, setAlt] = useState(formatarDecimal(caixa?.altura_cm))
  const [copiarDe, setCopiarDe] = useState(inicial?.copiarDe ?? '')
  const [copiarTocado, setCopiarTocado] = useState(inicial?.copiarDe !== undefined)

  // Número sugerido atualiza quando a lista de caixas carrega.
  useEffect(() => {
    if (!numeroTocado) setNumero(String(proximo))
  }, [proximo, numeroTocado])

  const nomesExistentes = useMemo(() => [...new Set(caixas.map((c) => c.nome))].sort(), [caixas])
  const locais = useMemo(
    () => [...new Set(caixas.map((c) => c.local).filter((l): l is string => !!l))].sort(),
    [caixas],
  )
  const comConteudo = useMemo(() => caixas.filter((c) => c.qtd_itens > 0 && c.id !== caixa?.id), [caixas, caixa])

  // Ao digitar o nome de um tipo que já existe, completa o que estiver vazio.
  const chaveNome = normalizar(nome)
  useEffect(() => {
    if (editando || !chaveNome) return
    const mesmas = caixas.filter((c) => normalizar(c.nome) === chaveNome)
    if (!mesmas.length) return
    const ref = mesmas[0]
    setCorId((atual) => atual ?? ref.cor_id)
    setTamanho((atual) => atual || ref.tamanho || '')
    setLocal((atual) => atual || ref.local || '')
    setPeso((atual) => atual || formatarDecimal(ref.peso_kg))
    setComp((atual) => atual || formatarDecimal(ref.comprimento_cm))
    setLarg((atual) => atual || formatarDecimal(ref.largura_cm))
    setAlt((atual) => atual || formatarDecimal(ref.altura_cm))
    if (!copiarTocado) {
      const modelo = mesmas.find((c) => c.qtd_itens > 0)
      if (modelo) setCopiarDe(modelo.id)
    }
  }, [chaveNome, caixas, editando, copiarTocado])

  const n = Number.parseInt(numero, 10)
  const qtd = editando ? 1 : Math.max(1, Math.min(60, Number.parseInt(quantidade, 10) || 1))
  const numeros = Number.isFinite(n) && n > 0 ? Array.from({ length: qtd }, (_, i) => n + i) : []
  const usados = new Set(caixas.filter((c) => c.id !== caixa?.id).map((c) => c.numero))
  const conflitos = numeros.filter((x) => usados.has(x))
  const corSelecionada = cores.find((c) => c.id === corId)
  const valido = nome.trim().length > 0 && numeros.length > 0 && conflitos.length === 0

  const salvar = useAcao(
    async () => {
      const dados: DadosCaixa = {
        nome: nome.trim(),
        cor_id: corId,
        tamanho: tamanho || null,
        local: local.trim() || null,
        observacoes: observacoes.trim() || null,
        foto_modelo: null,
        peso_kg: lerDecimal(peso),
        comprimento_cm: lerDecimal(comp),
        largura_cm: lerDecimal(larg),
        altura_cm: lerDecimal(alt),
      }
      if (caixa) {
        await atualizarCaixas([caixa.id], { ...dados, numero: n })
        return [{ id: caixa.id, numero: n }]
      }
      return criarCaixas(dados, numeros, copiarDe || null)
    },
    (r) =>
      editando ? 'Caixa atualizada.' : r.length === 1 ? `Caixa ${r[0].numero} criada.` : `${r.length} caixas criadas.`,
  )

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!valido || salvar.isPending) return
    salvar.mutate(undefined, {
      onSuccess: (criadas) => {
        aoFechar()
        if (editando) return
        if (criadas.length === 1) navigate(`/caixas/${criadas[0].id}`)
        else navigate(`/tipo/${encodeURIComponent(nome.trim())}`)
      },
    })
  }

  return (
    <form id="form-caixa" onSubmit={enviar} className="flex flex-col gap-5">
      <Campo rotulo="Nome do tipo" dica="Caixas com o mesmo nome aparecem juntas na tela inicial.">
        <input
          className="campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          list="nomes-tipos"
          placeholder="Ex.: ASAP 12"
          required
          autoFocus={!editando}
          autoCapitalize="characters"
        />
        <datalist id="nomes-tipos">
          {nomesExistentes.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo={qtd > 1 ? 'Primeiro número' : 'Número da caixa'}>
          <input
            className="campo font-display text-xl font-bold"
            inputMode="numeric"
            value={numero}
            onChange={(e) => {
              setNumeroTocado(true)
              setNumero(e.target.value.replace(/\D/g, ''))
            }}
            required
          />
        </Campo>
        {!editando && (
          <Campo rotulo="Quantas caixas">
            <input
              className="campo font-display text-xl font-bold"
              inputMode="numeric"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
            />
          </Campo>
        )}
      </div>
      {numeros.length > 1 && conflitos.length === 0 && (
        <p className="-mt-3 text-sm text-zinc-500">
          Serão criadas as caixas {numeros[0]} a {numeros[numeros.length - 1]}.
        </p>
      )}
      {conflitos.length > 0 && (
        <p className="-mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {conflitos.length === 1 ? `O número ${conflitos[0]} já está em uso.` : `Os números ${conflitos.join(', ')} já estão em uso.`}{' '}
          Próximo livre: {proximo}.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Cor</span>
        <div className="flex flex-wrap gap-2">
          {cores.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCorId(corId === c.id ? null : c.id)}
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
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Tamanho</span>
        <Segmentado opcoes={OPCOES_TAMANHO.map((o) => ({ valor: o.valor || 'nenhum', rotulo: o.rotulo }))}
          valor={tamanho || 'nenhum'}
          aoMudar={(v) => setTamanho(v === 'nenhum' ? '' : (v as Tamanho))}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Medidas e peso (opcional)</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['Comprimento', comp, setComp, 'cm'],
              ['Largura', larg, setLarg, 'cm'],
              ['Altura', alt, setAlt, 'cm'],
              ['Peso', peso, setPeso, 'kg'],
            ] as const
          ).map(([rotulo, valor, mudar, unidade]) => (
            <label key={rotulo} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">{rotulo}</span>
              <div className="relative">
                <input
                  className="campo pr-10"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => mudar(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {unidade}
                </span>
              </div>
            </label>
          ))}
        </div>
        {(() => {
          const v = volumeM3({ comprimento_cm: lerDecimal(comp), largura_cm: lerDecimal(larg), altura_cm: lerDecimal(alt) })
          return v ? <span className="text-xs text-zinc-500">Volume: {formatarDecimal(v, 4)} m³</span> : null
        })()}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Foto da caixa</span>
        {(() => {
          const modelo = modeloPorTamanho(corSelecionada?.nome ?? null, tamanho || null) ?? corSelecionada?.foto_modelo
          return (
            <div className="flex items-center gap-3">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                {modelo && <img src={srcModelo(modelo)} alt="" className="size-full object-contain" />}
              </div>
              <span className="text-xs text-zinc-500">
                {modelo
                  ? 'Escolhida automaticamente pela cor e pelo tamanho. Usada enquanto a caixa não tiver foto própria.'
                  : 'Escolha a cor para definir a foto.'}
              </span>
            </div>
          )
        })()}
      </div>

      <Campo rotulo="Local (opcional)">
        <input
          className="campo"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          list="locais-caixas"
          placeholder="Ex.: Depósito, prateleira B"
        />
        <datalist id="locais-caixas">
          {locais.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Campo>

      {!editando && comConteudo.length > 0 && (
        <Campo rotulo="Copiar materiais de (opcional)" dica="Já cria a caixa com o mesmo conteúdo da escolhida.">
          <select
            className="campo"
            value={copiarDe}
            onChange={(e) => {
              setCopiarTocado(true)
              setCopiarDe(e.target.value)
            }}
          >
            <option value="">Não copiar — começar vazia</option>
            {comConteudo.map((c) => (
              <option key={c.id} value={c.id}>
                Nº {c.numero} · {c.nome} ({c.qtd_itens} {c.qtd_itens === 1 ? 'material' : 'materiais'})
              </option>
            ))}
          </select>
        </Campo>
      )}

      <Campo rotulo="Observações (opcional)">
        <textarea
          className="campo min-h-20"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
        />
      </Campo>
    </form>
  )
}
