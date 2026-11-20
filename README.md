# Inventário de Caixas

Consulta, cadastro e conferência de materiais guardados em caixas.
Feito para usar no iPad, no celular ou no computador.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 (Vite) · Supabase (Postgres, Auth, Storage) · Vercel.

## O que o app faz

- **Caixas**: lista e grade, filtro rápido por cor e busca por nome, número ou material.
  Caixas com o mesmo nome viram um cartão só, com o contador preto mostrando quantas são.
- **Caixa**: fotos (câmera ou galeria), conteúdo com quantidade editável, adicionar material do catálogo
  ou criar um novo na hora, remover, duplicar a caixa e copiar o conteúdo para outras caixas.
- **Tipo**: edita nome, cor, tamanho e foto de todas as caixas do mesmo tipo de uma vez.
- **Materiais**: catálogo com fotos, categoria, unidade e "onde está" (em quais caixas e quanto).
- **Conferência**: checklist item a item (completo / falta), observações e pendências.
  A conferência vence depois de N dias (configurável; padrão 30).
- **Imprimir**: adesivos (com materiais ou geral, fundo branco ou preto, com QR code da caixa)
  e lista de conferência em papel. No iPad: Imprimir → Salvar em Arquivos gera o PDF.
- **Histórico**: tudo o que foi criado, alterado ou excluído, com autor e data.
- **Usuários**: quem cria conta fica sem acesso até um administrador liberar.
- **Backup**: exporta tudo em JSON e a planilha (CSV) do conteúdo das caixas.

## Níveis de acesso

| Papel | Pode |
| --- | --- |
| Sem acesso | nada (aguardando aprovação) |
| Conferente | consultar e registrar conferências |
| Editor | + cadastrar e editar caixas, materiais e fotos |
| Administrador | + excluir caixas/materiais, aprovar usuários, cores, validade e backup |

A primeira conta criada vira administrador automaticamente. As regras valem no banco (RLS),
não só na tela.

## Rodar localmente

```bash
npm install
npm run dev
```

As chaves públicas do Supabase já estão no código (`src/lib/supabase.ts`); para usar outro projeto,
copie `.env.example` para `.env.local` e ajuste.

## Banco de dados

O esquema completo está em `supabase/migrations/0001_inicial.sql`
(tabelas, permissões, histórico automático, bucket de fotos e funções).

## Configuração no painel do Supabase (uma vez)

1. **Authentication → URL Configuration**: em *Site URL*, coloque o endereço do app na Vercel
   e adicione o mesmo endereço com `/**` em *Redirect URLs*.
2. **Authentication → Sign In / Providers → Email**: desligue *Confirm email*
   (a aprovação pelo administrador já controla o acesso, e o e-mail gratuito do Supabase
   envia só poucas mensagens por hora).
3. Opcional, login com Google: ative o provedor Google com as credenciais do Google Cloud
   e defina `VITE_LOGIN_GOOGLE=1` na Vercel.

## Deploy

A Vercel publica a cada `git push` na branch principal. O `vercel.json` também agenda
uma chamada diária (`/api/manter-ativo`) para o projeto gratuito do Supabase não pausar.
