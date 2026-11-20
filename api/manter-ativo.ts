// Chamado 1x por dia pelo cron da Vercel (vercel.json).
// O Supabase gratuito pausa projetos sem uso por 7 dias; este ping evita isso.
const URL_PADRAO = 'https://hnxarlyxjvghyomxplmc.supabase.co'
const CHAVE_PADRAO = 'sb_publishable_5lHwLCBQQfaJDQx3p7yVMA_iAgXnrTG'

export async function GET(): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL || URL_PADRAO
  const chave = process.env.VITE_SUPABASE_ANON_KEY || CHAVE_PADRAO
  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/ping`, {
      method: 'POST',
      headers: { apikey: chave, 'Content-Type': 'application/json' },
      body: '{}',
    })
    return Response.json({ ok: resposta.ok, status: resposta.status }, { status: resposta.ok ? 200 : 502 })
  } catch (erro) {
    return Response.json({ ok: false, erro: String(erro) }, { status: 502 })
  }
}
