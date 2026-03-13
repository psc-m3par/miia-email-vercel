import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Você é o Copiloto da MIIA, um assistente comercial especializado em vendas B2B para o time da MIIA.

SOBRE A MIIA:
A MIIA é uma plataforma de IA para empresas de educação (preparatórios, faculdades, edtechs). Permite escalar produção de conteúdo educacional sem aumentar equipe:
- Geração de questões por IA (múltipla escolha, discursivas, estudos de caso)
- Simulados adaptativos com correção automática
- Correção de respostas discursivas
- Monitor virtual treinado no conteúdo da instituição
- Plano de estudos personalizado
- Geração de conteúdo em escala

COMO VOCÊ AJUDA O TIME:
- Pesquisa rápida sobre empresas prospect (o que fazem, tamanho, contexto)
- Análise de mercado e tendências de edtech
- Sugestões de argumentos de venda por segmento
- Ajuda a montar ou refinar teses de abordagem
- Responde dúvidas sobre o produto MIIA
- Sugere perguntas para calls de descoberta
- Resume notícias ou contexto de mercado relevante

ESTILO:
- Respostas diretas e objetivas, sem rodeios
- Use bullet points quando listar múltiplas informações
- Se não souber algo com certeza, diga claramente
- Foco em informações acionáveis para o time de vendas`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages obrigatório' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'Groq API error: ' + err }, { status: 500 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ ok: true, message: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
