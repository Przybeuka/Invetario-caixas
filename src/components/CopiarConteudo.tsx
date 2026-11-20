import { useMemo, useState } from 'react'
import { copiarConteudo, useAcao, useCaixas } from '../lib/api'
import type { CaixaResumo } from '../lib/tipos'
import { cn, normalizar, plural } from '../lib/util'
import { Modal } from './Modal'
import { Botao, Ponto, Segmentado } from './ui'

/** Copia o conteúdo de uma caixa para outras (as do mesmo tipo já vêm marcadas). */
export function CopiarConteudo({
  aberto,
  aoFechar,
  origem,
}: {
  aberto: boolean
  aoFechar: () => void
  origem: CaixaResumo
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Copiar conteúdo"
      subtitulo={`Da caixa ${origem.numero} · ${origem.nome} (${plural(origem.qtd_itens, 'material', 'materiais')})`}
      largura="max-w-xl"
    >
      <Conteudo origem={origem} aoFechar={aoFechar} />
    </Modal>
  )
}

function Conteudo({ origem, aoFechar }: { origem: CaixaResumo; aoFechar: () => void }) {
  const { data: caixas = [] } = useCaixas()
  const outras = useMemo(() => caixas.filter((c) => c.id !== origem.id), [caixas, origem.id])
  const mesmoTipo = useMemo(
    () => outras.filter((c) => normalizar(c.nome) === normalizar(origem.nome)),
    [outras, origem.nome],
  )
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set(mesmoTipo.map((c) => c.id)))
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('substituir')

  const copiar = useAcao(
    () => copiarConteudo(origem.id, [...selecionadas], modo === 'substituir'),
    () => `Conteúdo copiado para ${plural(selecionadas.size, 'caixa', 'caixas')}.`,
  )

  function alternar(id: string) {
    setSelecionadas((s) => {
      const nova = new Set(s)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  const ordenadas = [...mesmoTipo, ...outras.filter((c) => !mesmoTipo.includes(c))]

  return (
    <div className="flex flex-col gap-4">
      <Segmentado
        className="w-full"
        valor={modo}
        aoMudar={setModo}
        opcoes={[
          { valor: 'substituir', rotulo: 'Substituir tudo' },
          { valor: 'mesclar', rotulo: 'Só acrescentar' },
        ]}
      />
      <p className="text-sm text-zinc-500">
        {modo === 'substituir'
          ? 'As caixas marcadas ficam com exatamente o mesmo conteúdo da origem.'
          : 'Acrescenta os materiais da origem e atualiza as quantidades; o resto é mantido.'}
      </p>
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {ordenadas.map((c) => (
          <li key={c.id}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition',
                selecionadas.has(c.id) ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
              )}
            >
              <input
                type="checkbox"
                className="size-5 accent-zinc-900"
                checked={selecionadas.has(c.id)}
                onChange={() => alternar(c.id)}
              />
              <span className="w-12 font-display text-xl font-bold">{c.numero}</span>
              <Ponto hex={c.cor_hex ?? '#a1a1aa'} />
              <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
              <span className="text-xs text-zinc-500">{plural(c.qtd_itens, 'material', 'materiais')}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao
          variante="primario"
          disabled={!selecionadas.size}
          carregando={copiar.isPending}
          onClick={() => copiar.mutate(undefined, { onSuccess: aoFechar })}
        >
          Copiar para {selecionadas.size}
        </Botao>
      </div>
    </div>
  )
}
