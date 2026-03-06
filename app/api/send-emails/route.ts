import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const allIds = getAllSpreadsheetIds();
    let totalEnviados = 0;
    let erros: string[] = [];
    let debug: any = { spreadsheets: allIds, categories: [] };

    for (const spreadsheetId of allIds) {
      const [painel, templates, { contacts }] = await Promise.all([
        readPainel(spreadsheetId),
        readTemplates(spreadsheetId),
        readContatos(spreadsheetId),
      ]);

      debug.totalContatos = contacts.length;
      debug.painelCount = painel.length;

      for (const cat of painel) {
        const template = templates.find(t => t.category.normalize('NFC') === cat.category.normalize('NFC'));
        const pendentes = contacts.filter(c =>
          c.category.normalize('NFC') === cat.category.normalize('NFC') && !c.email1Enviado && c.email
        );

        debug.categories.push({
          category: cat.category,
          ativo: cat.ativo,
          responsavel: cat.responsavel,
          hasTemplate: !!template,
          pendentes: pendentes.length,
          sampleContact: pendentes[0] ? { email: pendentes[0].email, category: pendentes[0].category, email1Enviado: pendentes[0].email1Enviado } : null,
        });

        if (!cat.ativo) continue;
        if (!template) continue;

        const lote = pendentes.slice(0, cat.emailsHora);

        for (const contato of lote) {
          const assunto = template.assunto
            .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
            .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
            .replace(/\{companyName\}|\[Company\]/gi, contato.companyName);

          const corpo = template.corpo
            .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
            .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
            .replace(/\{companyName\}|\[Company\]/gi, contato.companyName);

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

          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return NextResponse.json({ ok: true, enviados: totalEnviados, erros, debug });
  } catch (error: any) {
    console.error('Send emails error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}