import { useQueryClient } from '@tanstack/react-query'
import { FileJson, FileSpreadsheet, LogOut, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ROTULO_PAPEL, useAuth, usePermissoes } from '../auth/auth'
import { useAvisos } from '../components/avisos'
import { aplicarTema, temaAtual } from '../components/Layout'
import { Modal } from '../components/Modal'
import { SeletorModelo } from '../components/SeletorModelo'
import { Botao, BotaoIcone, Campo, Ponto, Secao, Segmentado } from '../components/ui'
import {
  atualizarPerfil,
  excluirCor,
  gerarBackup,
  linhasPlanilha,
  salvarConfig,
  salvarCor,
  useAcao,
  useCaixas,
  useConfig,
  useCores,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Cor } from '../lib/tipos'
import { baixarArquivo, mensagemErro, ROTULO_TAMANHO } from '../lib/util'

function MeuPerfil() {
  const { perfil, recarregarPerfil } = useAuth()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const salvar = useAcao(async () => {
    if (!perfil) return 0
    const n = await atualizarPerfil(perfil.id, { nome: nome.trim() })
    await recarregarPerfil()
    return n
  }, 'Nome atualizado.')
  return (
    <form
      className="cartao flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        salvar.mutate(undefined)
      }}
    >
      <div className="text-sm text-zinc-500">
        {perfil?.email} · <span className="font-semibold text-zinc-800 dark:text-zinc-200">{perfil ? ROTULO_PAPEL[perfil.papel] : ''}</span>
      </div>
      <Campo rotulo="Nome exibido">
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </Campo>
      <Botao type="submit" variante="primario" className="self-start" carregando={salvar.isPending} icone={<Save className="size-4" />}>
        Salvar nome
      </Botao>
    </form>
  )
}

function TrocarSenha() {
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { avisar } = useAvisos()
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) avisar(mensagemErro(error), 'erro')
    else {
      setSenha('')
      avisar('Senha alterada.')
    }
  }
  return (
    <form onSubmit={enviar} className="cartao flex flex-col gap-4 p-4">
      <Campo rotulo="Nova senha" dica="Mínimo de 6 caracteres.">
        <input
          className="campo"
          type="password"
          minLength={6}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
      </Campo>
      <Botao type="submit" className="self-start" carregando={salvando}>
        Alterar senha
      </Botao>
    </form>
  )
}

function Aparencia() {
  const [tema, setTema] = useState(temaAtual)
  return (
    <Segmentado
      className="w-full max-w-md"
      valor={tema}
      aoMudar={(t) => {
        setTema(t)
        aplicarTema(t)
      }}
      opcoes={[
        { valor: 'claro', rotulo: 'Claro' },
        { valor: 'escuro', rotulo: 'Escuro' },
        { valor: 'sistema', rotulo: 'Automático' },
      ]}
    />
  )
}

function Validade() {
  const { data: config } = useConfig()
  const [dias, setDias] = useState('30')
  useEffect(() => {
    if (config) setDias(String(config.validade_conferencia_dias))
  }, [config])
  const salvar = useAcao(
    () => salvarConfig({ validade_conferencia_dias: Math.max(0, Number.parseInt(dias, 10) || 0) }),
    'Validade atualizada.',
  )
  return (
    <form
      className="cartao flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        salvar.mutate(undefined)
      }}
    >
      <Campo rotulo="Conferência vale (dias)" dica="Depois disso a caixa aparece como vencida. Use 0 para nunca vencer." className="flex-1">
        <input className="campo max-w-40" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} />
      </Campo>
      <Botao type="submit" carregando={salvar.isPending}>
        Salvar
      </Botao>
    </form>
  )
}

function EditorCor({ cor, aoFechar }: { cor: Partial<Cor> | null; aoFechar: () => void }) {
  const [nome, setNome] = useState(cor?.nome ?? '')
  const [hex, setHex] = useState(cor?.hex ?? '#71717a')
  const [modelo, setModelo] = useState<string | null>(cor?.foto_modelo ?? null)
  const { data: cores = [] } = useCores()
  const salvar = useAcao(
    () =>
      salvarCor({
        id: cor?.id,
        nome: nome.trim(),
        hex: hex.toUpperCase(),
        foto_modelo: modelo,
        ordem: cor?.ordem ?? cores.length + 1,
      }),
    cor?.id ? 'Cor atualizada.' : 'Cor criada.',
  )
  return (
    <form
      id="form-cor"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        salvar.mutate(undefined, { onSuccess: aoFechar })
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Campo rotulo="Nome">
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Campo>
        <Campo rotulo="Cor">
          <input type="color" className="h-12 w-20 cursor-pointer rounded-xl border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900" value={hex} onChange={(e) => setHex(e.target.value)} />
        </Campo>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="rotulo">Foto padrão da cor</span>
        <SeletorModelo valor={modelo} aoMudar={setModelo} corPreferida={nome} rotuloVazio="Sem foto" />
      </div>
    </form>
  )
}

function Cores() {
  const { data: cores = [] } = useCores()
  const { data: caixas = [] } = useCaixas()
  const { confirmar } = useAvisos()
  const [editando, setEditando] = useState<Partial<Cor> | null>(null)
  const excluir = useAcao((id: string) => excluirCor(id), 'Cor excluída.')
  return (
    <div className="flex flex-col gap-3">
      <ul className="cartao divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
        {cores.map((c) => {
          const usadas = caixas.filter((x) => x.cor_id === c.id).length
          return (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <Ponto hex={c.hex} className="size-6" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(c)}>
                <span className="block font-semibold">{c.nome}</span>
                <span className="block text-xs text-zinc-500">
                  {c.hex} · {usadas} {usadas === 1 ? 'caixa' : 'caixas'}
                </span>
              </button>
              <BotaoIcone
                rotulo={`Excluir ${c.nome}`}
                className="text-red-600"
                onClick={async () => {
                  const ok = await confirmar({
                    titulo: `Excluir a cor ${c.nome}?`,
                    mensagem: usadas ? `${usadas} caixas ficarão sem cor.` : 'Nenhuma caixa usa esta cor.',
                    confirmar: 'Excluir',
                    perigo: true,
                  })
                  if (ok) excluir.mutate(c.id)
                }}
              >
                <Trash2 className="size-4" />
              </BotaoIcone>
            </li>
          )
        })}
      </ul>
      <Botao className="self-start" icone={<Plus className="size-4" />} onClick={() => setEditando({})}>
        Nova cor
      </Botao>
      <Modal
        aberto={!!editando}
        aoFechar={() => setEditando(null)}
        titulo={editando?.id ? 'Editar cor' : 'Nova cor'}
        largura="max-w-2xl"
        rodape={
          <div className="flex justify-end gap-2">
            <Botao onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao variante="primario" type="submit" form="form-cor">
              Salvar
            </Botao>
          </div>
        }
      >
        <EditorCor cor={editando} aoFechar={() => setEditando(null)} />
      </Modal>
    </div>
  )
}

function csv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function Backup() {
  const { avisar } = useAvisos()
  const [gerando, setGerando] = useState<'json' | 'csv' | null>(null)
  const data = new Date().toISOString().slice(0, 10)

  async function json() {
    setGerando('json')
    try {
      const backup = await gerarBackup()
      baixarArquivo(`inventario-backup-${data}.json`, JSON.stringify(backup, null, 2), 'application/json')
      avisar('Backup gerado.')
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setGerando(null)
    }
  }

  async function planilha() {
    setGerando('csv')
    try {
      const linhas = await linhasPlanilha()
      const cabecalho = ['Caixa', 'Tipo', 'Cor', 'Tamanho', 'Local', 'Material', 'Categoria', 'Quantidade', 'Unidade', 'Observação']
      const corpo = linhas.map((l) =>
        [
          l.caixa.numero,
          l.caixa.nome,
          l.caixa.cor?.nome,
          l.caixa.tamanho ? ROTULO_TAMANHO[l.caixa.tamanho as keyof typeof ROTULO_TAMANHO] : '',
          l.caixa.local,
          l.material.nome,
          l.material.categoria,
          String(l.quantidade).replace('.', ','),
          l.material.unidade,
          l.observacao,
        ]
          .map(csv)
          .join(';'),
      )
      baixarArquivo(`inventario-${data}.csv`, '﻿' + [cabecalho.join(';'), ...corpo].join('\r\n'), 'text/csv;charset=utf-8')
      avisar('Planilha gerada.')
    } catch (erro) {
      avisar(mensagemErro(erro), 'erro')
    } finally {
      setGerando(null)
    }
  }

  return (
    <div className="cartao flex flex-col gap-3 p-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Baixe uma cópia de tudo de tempos em tempos. O JSON guarda todos os dados (para restaurar); a planilha abre no Excel com o conteúdo de cada caixa.
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao icone={<FileJson className="size-4" />} carregando={gerando === 'json'} onClick={json}>
          Backup completo (JSON)
        </Botao>
        <Botao icone={<FileSpreadsheet className="size-4" />} carregando={gerando === 'csv'} onClick={planilha}>
          Planilha (CSV)
        </Botao>
      </div>
    </div>
  )
}

export function Conta() {
  const { sair } = useAuth()
  const { ehAdmin } = usePermissoes()
  const qc = useQueryClient()
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-bold">Minha conta</h1>
        <Botao
          icone={<LogOut className="size-4" />}
          onClick={async () => {
            await sair()
            qc.clear()
          }}
        >
          Sair
        </Botao>
      </div>
      <Secao titulo="Perfil">
        <MeuPerfil />
      </Secao>
      <Secao titulo="Senha">
        <TrocarSenha />
      </Secao>
      <Secao titulo="Aparência">
        <Aparencia />
      </Secao>
      {ehAdmin && (
        <>
          <Secao titulo="Conferência">
            <Validade />
          </Secao>
          <Secao titulo="Cores das caixas">
            <Cores />
          </Secao>
          <Secao titulo="Backup">
            <Backup />
          </Secao>
        </>
      )}
    </div>
  )
}
