import { NextResponse } from 'next/server';
import { getDashboardStats, readContatos, readPainel, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function isComplete(s: any): boolean {
  const semFup1 = s.email1 - s.respondidos - s.bounced - s.fup1;
  const semFup2 = s.fup1 - (s.fup1Respondidos || 0) - (s.fup1Bounced || 0) - s.fup2;
  return s.pendentes === 0 && s.total > 0 && semFup1 <= 0 && semFup2 <= 0;
}

function pct(num: number, den: number): string {
  if (den === 0) return '0%';
  return Math.round((num / den) * 100) + '%';
}

export async function GET() {
  try {
    const spreadsheetId = getAllSpreadsheetIds()[0];
    const [{ stats, totalGeral, painel }, { contacts }] = await Promise.all([
      getDashboardStats(),
      readContatos(spreadsheetId),
    ]);

    const dataFormatada = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // Pipeline counts
    const pipelineCounts: Record<string, number> = { NOVO: 0, NEGOCIACAO: 0, CONVERSANDO: 0, REUNIAO: 0, AGUARDANDO_MATERIAIS: 0, GANHO: 0, PERDIDO: 0 };
    const reuniaoEmpresas: string[] = [];
    for (const c of contacts) {
      if (c.pipeline && pipelineCounts[c.pipeline] !== undefined) {
        pipelineCounts[c.pipeline]++;
        if (c.pipeline === 'REUNIAO' && c.companyName && !reuniaoEmpresas.includes(c.companyName)) {
          reuniaoEmpresas.push(c.companyName);
        }
      }
    }

    // Categorize bases
    const activeBases: string[] = [];
    const completedBases: string[] = [];
    const newBases: string[] = [];

    for (const [cat, s] of Object.entries(stats) as [string, any][]) {
      const p = painel.find((x: any) => x.category === cat);
      if (!p) continue;
      if (isComplete(s)) {
        completedBases.push(cat);
      } else if (s.email1 < s.total * 0.3 && s.pendentes > 0) {
        newBases.push(cat);
      } else {
        activeBases.push(cat);
      }
    }

    // Build report
    let text = `Pessoal, segue aqui o report comercial consolidado:\n\n`;

    // Atividade de hoje
    text += `📧 Atividade de Hoje\n`;
    text += `Hoje foram disparados ${totalGeral.hojeEmail1} emails iniciais, ${totalGeral.hojeFup1} follow-ups 1 e ${totalGeral.hojeFup2} follow-ups 2, totalizando ${totalGeral.hojeEmail1 + totalGeral.hojeFup1 + totalGeral.hojeFup2} envios no dia. `;
    text += `Temos ${totalGeral.respondidos} respostas acumuladas e ${totalGeral.pendentes} pendentes. `;
    text += `No acumulado, a base total é de ${Object.values(stats).reduce((s: number, x: any) => s + x.total, 0)} contatos, dos quais ${totalGeral.email1} já receberam o primeiro email, ${totalGeral.fup1} o FUP1 e ${totalGeral.fup2} o FUP2.\n\n`;

    // Pipeline comercial
    text += `📊 Pipeline Comercial\n`;
    const pipeTexts: string[] = [];
    if (pipelineCounts.NOVO > 0) pipeTexts.push(`${pipelineCounts.NOVO} novos`);
    if (pipelineCounts.CONVERSANDO > 0) pipeTexts.push(`${pipelineCounts.CONVERSANDO} em conversa`);
    if (pipelineCounts.NEGOCIACAO > 0) pipeTexts.push(`${pipelineCounts.NEGOCIACAO} em negociação`);
    if (pipelineCounts.AGUARDANDO_MATERIAIS > 0) pipeTexts.push(`${pipelineCounts.AGUARDANDO_MATERIAIS} aguardando materiais`);
    if (pipelineCounts.REUNIAO > 0) pipeTexts.push(`${pipelineCounts.REUNIAO} com reunião marcada`);
    if (pipelineCounts.GANHO > 0) pipeTexts.push(`${pipelineCounts.GANHO} ganhos`);
    if (pipelineCounts.PERDIDO > 0) pipeTexts.push(`${pipelineCounts.PERDIDO} sem interesse`);
    text += `O pipeline tem ${pipeTexts.join(', ')}. `;
    if (reuniaoEmpresas.length > 0) {
      text += `As reuniões marcadas são com ${reuniaoEmpresas.join(', ')}.`;
    }
    text += `\n\n`;

    // Bases ativas por categoria
    if (activeBases.length > 0) {
      text += `📋 Bases Ativas por Categoria\n`;
      for (const cat of activeBases) {
        const s = stats[cat] as any;
        const taxaResp = pct(s.respondidos, s.email1);
        const taxaConv = pct(s.conversoes || 0, s.email1);
        const emailsPerResp = s.respondidos > 0 ? Math.round(s.email1 / s.respondidos) : 0;
        text += `\n• ${cat} (${s.total} contatos): ${s.email1} emails enviados, ${s.fup1} FUP1, ${s.fup2} FUP2. `;
        text += `Taxa de respostas: ${taxaResp}, taxa de conversão: ${taxaConv}`;
        if (emailsPerResp > 0) text += `, ${emailsPerResp} emails/resposta`;
        text += `. `;
        if (s.bounced > 0) text += `Bounce: ${s.bounced}. `;
        if (s.pendentes > 0) text += `${s.pendentes} pendentes de E1.`;
      }
      text += `\n\n`;
    }

    // Bases com ciclo completo
    if (completedBases.length > 0) {
      text += `✅ Bases com Ciclo Completo\n`;
      for (const cat of completedBases) {
        const s = stats[cat] as any;
        const taxaResp = pct(s.respondidos, s.email1);
        const taxaConv = pct(s.conversoes || 0, s.email1);
        text += `\n• ${cat}: ${s.total} contatos prospectados, ${s.respondidos} respostas (${taxaResp}), ${s.conversoes || 0} conversões (${taxaConv}).`;
      }
      text += `\n\n`;
    }

    // Novas bases
    if (newBases.length > 0) {
      text += `🆕 Novas Bases (Iniciando Envio)\n`;
      for (const cat of newBases) {
        const s = stats[cat] as any;
        text += `\n• ${cat}: ${s.total} contatos, ${s.email1} enviados até agora`;
        if (s.bounced > 0) text += `, ${s.bounced} bounces`;
        if (s.respondidos > 0) text += `, ${s.respondidos} respostas`;
        text += `. Ainda no início do E1.`;
      }
      text += `\n`;
    }

    return NextResponse.json({ text, date: dataFormatada });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, recipients, senderEmail } = await request.json();
    if (!text || !recipients?.length || !senderEmail) {
      return NextResponse.json({ error: 'Texto, destinatários e remetente são obrigatórios' }, { status: 400 });
    }

    const spreadsheetId = getAllSpreadsheetIds()[0];
    const dataFormatada = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#f8fafc;padding:24px">
  <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 32px;border-radius:16px 16px 0 0">
    <h1 style="color:white;margin:0;font-size:22px;font-weight:700">MIIA — Relatório Comercial</h1>
    <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px">${dataFormatada}</p>
  </div>
  <div style="background:white;padding:28px 32px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:0">
    <div style="font-size:14px;line-height:1.8;color:#334155;white-space:pre-wrap">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">MIIA Email Automation</p>
</div>`;

    for (const recipient of recipients) {
      await sendEmail(
        senderEmail,
        recipient,
        `MIIA — Relatório Comercial ${dataFormatada}`,
        htmlBody,
        undefined,
        spreadsheetId
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
