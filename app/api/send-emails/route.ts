import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendEmail, sendReply } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const allIds = getAllSpreadsheetIds();
    let totalEnviados = 0;
    let erros: string[] = [];

    for (const spreadsheetId of allIds) {
      const [painel, templates, { contacts }] = await Promise.all([
        readPainel(spreadsheetId),
        readTemplates(spreadsheetId),
        readContatos(spreadsheetId),
      ]);

      for (const cat of painel) {
        if (!cat.ativo) continue;

        const template = templates.find(t => t.category === cat.category);
        if (!template) continue;

        const pendentes = contacts.filter(c =>
          c.category === cat.category && !c.email1Enviado && c.email
        );

        const lote = pendentes.slice(0, cat.emailsHora);

        for (const contato of lote) {
          const assunto = template.assunto
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const corpo = template.corpo
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const result = await sendEmail(
            cat.responsavel,
            contato.email,
            assunto,
            corpo,
            cat.cc,
            spreadsheetId
          );

          const hoje = new Date().toISOString().split('T')[0];

          if (result.success) {
            await writeSheet(
              `Contatos!H${contato.rowIndex}:K${contato.rowIndex}`,
              [[`OK ${hoje}`, '', '', result.threadId || '']],
              spreadsheetId
            );
            totalEnviados++;
          } else {
            await writeSheet(
              `Contatos!H${contato.rowIndex}`,
              [[`ERRO ${hoje}: ${result.error}`]],
              spreadsheetId
            );
            erros.push(`${contato.email}: ${result.error}`);
          }

          // Pausa de 2s entre emails pra não estourar rate limit
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return NextResponse.json({ ok: true, enviados: totalEnviados, erros });
  } catch (error: any) {
    console.error('Send emails error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}