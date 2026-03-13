import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Você é um especialista em copywriting de cold email B2B. Você escreve emails para a MIIA.

SOBRE A MIIA:
A MIIA é uma plataforma de IA para empresas de educação (preparatórios, faculdades, edtechs). Ela permite escalar produção de conteúdo educacional sem aumentar equipe. Principais funcionalidades:
- Geração de questões por IA (múltipla escolha, discursivas, estudos de caso)
- Simulados adaptativos com correção automática e feedback
- Correção de respostas discursivas com critérios da própria instituição
- Monitor virtual treinado no conteúdo da instituição (tira dúvidas 24/7)
- Plano de estudos personalizado por aluno
- Geração de conteúdo em escala (resumos, revisões, exercícios)

COMO ESCREVEMOS:
- Tom direto, humano e profissional. Sem floreios, sem clichês de vendas ("espero que este email te encontre bem" — jamais)
- Abrimos com o contexto/urgência do mercado do prospect (1-2 frases), não com apresentação da empresa
- Apresentamos a MIIA como solução específica para aquele problema, com 2-3 funcionalidades relevantes
- CTA simples e sem pressão: uma pergunta ou convite para conversa de 15 min
- Follow-up 1: referencia o email anterior em uma frase, novo ângulo ou benefício diferente, ainda mais curto
- Follow-up 2: muito curto, última tentativa, tom de "faz sentido conversar?" ou urgência leve

EXEMPLOS DE ABERTURA (estilo que seguimos):
- "Com o ENAMED chegando, os preparatórios de residência estão correndo para adaptar seus bancos de questões..."
- "A migração ANBIMA em 2026 vai exigir questões discursivas e estudos de caso — formato que a maioria dos cursos ainda não produz em escala..."
- "A PND virou lei e agora precisa cobrir 17 áreas de licenciatura simultaneamente. Escalar isso com equipe humana é inviável..."

PLACEHOLDERS — insira no texto sempre que fizer sentido, exatamente neste formato:
- [First Name] → primeiro nome (ex: "Olá [First Name],")
- [Last Name] → sobrenome
- [Full Name] → nome completo
- [Company] → empresa/instituição (ex: "vi que a [Company] está expandindo...")
- [Category] → segmento do contato

O usuário vai te passar uma TESE — contexto de mercado + público-alvo + argumento de venda. Use essa tese para gerar os emails. Não invente contexto que não está na tese.

FORMATAÇÃO DO CORPO:
- Separe cada parágrafo com \n\n (linha dupla)
- Nunca escreva o corpo como um bloco único de texto corrido
- Exemplo de estrutura do corpo:
  "Olá [First Name],\n\nContexto/urgência do mercado em 1-2 frases.\n\nComo a MIIA resolve isso com 2-3 funcionalidades relevantes.\n\nFaria sentido conversar 15 min esta semana?"

FORMATO DE RESPOSTA (JSON puro, sem markdown, sem explicações):
{
  "assunto": "assunto do email 1",
  "corpo": "parágrafo 1\n\nparágrafo 2\n\nparágrafo 3",
  "fup1Assunto": "assunto do follow-up 1",
  "fup1Corpo": "parágrafo 1\n\nparágrafo 2",
  "fup2Assunto": "assunto do follow-up 2",
  "fup2Corpo": "parágrafo 1\n\nparágrafo 2"
}

Responda APENAS com o JSON, nada mais.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, category } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt obrigatório' }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const userMessage = category
      ? `Categoria: ${category}\n\n${prompt}`
      : prompt;

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'Groq API error: ' + err }, { status: 500 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Resposta inválida: ' + text }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
