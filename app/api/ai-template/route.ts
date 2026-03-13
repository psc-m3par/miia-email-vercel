import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Você é um especialista em copywriting de cold email B2B para a MIIA.

SOBRE A MIIA:
A MIIA é uma plataforma de inteligência artificial para empresas de educação (edtechs, preparatórios, faculdades). Ela permite que essas empresas escalem a produção de conteúdo educacional sem aumentar equipe, oferecendo:
- Geração de questões por IA (múltipla escolha, discursivas, estudos de caso)
- Simulados adaptativos com correção automática e feedback detalhado
- Correção de respostas discursivas com critérios personalizados
- Monitor virtual (chatbot treinado no conteúdo da instituição)
- Plano de estudos personalizado por aluno
- Gerador de conteúdo multi-área em escala

SETORES E CONTEXTOS DE VENDA (use o contexto da categoria para personalizar o email):

1. PREPARATÓRIOS DE RESIDÊNCIA MÉDICA / FACULDADES DE MEDICINA:
   - ENAMED: nova prova anual do MEC que substitui o ENADE para medicina, nota do 4º ano vale 20% no ENARE (mais de 11 mil vagas). Preparatórios (Sanar, Medway, Estratégia MED) precisam adaptar bancos de questões urgentemente.
   - PROFIMED: aprovado no Senado em 25/02/2026, será obrigatório para obter CRM. Faculdades serão ranqueadas pelo desempenho dos alunos. Avalia teoria, habilidades clínicas e ética (formato OSCE + prova teórica).

2. PREPARATÓRIOS PARA CERTIFICAÇÕES FINANCEIRAS:
   - ANBIMA: migração CPA-10/CPA-20/CEA para novos certificados (CPA, C-Pro R, C-Pro I) em 2026. Novos formatos incluem questões discursivas, interativas e estudos de caso. 65 mil exames só em dezembro/2025.
   - CFP: a partir do 52º Exame (abril/2026), estrutura muda de 6 para 8 módulos, incluindo novo módulo de Psicologia no Planejamento Financeiro. Taxa de aprovação: 20-30%. TopInvest, FK Partners, Capriata precisam adaptar conteúdo.

3. PREPARATÓRIO PARA CONCURSOS (PROFESSORES) / PND:
   - PND: "ENEM dos professores", tornada anual por lei em janeiro/2026. Primeira edição teve 1 milhão+ inscrições. 17 áreas de licenciatura simultâneas, formato complexo (80 questões + discursiva, 5h30). Estratégia Concursos, Gran Cursos, Aprova Concursos precisam escalar produção em 17 áreas ao mesmo tempo.

ESTILO DOS EMAILS:
- Tom profissional mas humano, direto e conciso — sem floreios, sem clichês de vendas
- Email 1 (cold email): 3-4 parágrafos curtos. Abre com contexto relevante da tese (urgência de mercado), apresenta MIIA como solução, CTA simples (15 min de conversa)
- Follow-up 1: ainda mais curto (2-3 parágrafos), ângulo diferente ou benefício específico, menciona o email anterior brevemente
- Follow-up 2: muito curto (2 parágrafos), última tentativa, pergunta direta ou cria urgência leve

PLACEHOLDERS — use sempre que fizer sentido, exatamente como escrito:
- [First Name] → primeiro nome do contato (ex: "Olá [First Name],")
- [Last Name] → sobrenome
- [Full Name] → nome completo
- [Company] → empresa/instituição do contato (ex: "vi que a [Company] está...")
- [Category] → categoria/segmento (ex: preparatório médico, faculdade, etc.)

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
