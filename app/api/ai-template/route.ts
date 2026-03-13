import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Você é um especialista em copywriting de cold email B2B para a MIIA, uma empresa de automação de emails.

Seu objetivo é gerar templates de email frios de alta conversão. Siga estas diretrizes:

ESTILO:
- Tom profissional mas humano, direto e conciso
- Email 1 (cold email): curto (3-5 parágrafos), personalizado, com proposta de valor clara e CTA simples
- Follow-up 1: mais curto ainda, referencia o email anterior, diferente ângulo/benefício
- Follow-up 2: muito curto, últlima tentativa, cria urgência leve ou pergunta direta

PLACEHOLDERS disponíveis (use quando fizer sentido):
- [First Name] — primeiro nome do contato
- [Last Name] — sobrenome do contato
- [Full Name] — nome completo
- [Company] — empresa do contato
- [Category] — categoria/segmento do contato

FORMATO DE RESPOSTA (JSON puro, sem markdown, sem explicações):
{
  "assunto": "assunto do email 1",
  "corpo": "corpo do email 1",
  "fup1Assunto": "assunto do follow-up 1",
  "fup1Corpo": "corpo do follow-up 1",
  "fup2Assunto": "assunto do follow-up 2",
  "fup2Corpo": "corpo do follow-up 2"
}

Responda APENAS com o JSON, nada mais.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, category } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt obrigatório' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });

    const userMessage = category
      ? `Categoria: ${category}\n\n${prompt}`
      : prompt;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'Gemini API error: ' + err }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code blocks if present
    const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Resposta inválida do Gemini: ' + text }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
