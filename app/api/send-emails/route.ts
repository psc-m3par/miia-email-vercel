import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runSendEmails(category?: string) {
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
      if (category && cat.category.normalize('NFC') !== category.normalize('NFC')) continue;

      const template = templates.find(t => t.category.normalize('NFC') === cat.category.normalize('NFC'));
      if (!template) continue;

      const pendentes = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') && !c.email1Enviado && c.email
      );

      const lote = pendentes.slice(0, cat.emailsHora || 20);

      for (const contato of lote) {
        const assunto = template.assunto
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const corpo = template.corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const result = await sendEmail(
          cat.responsavel,
          contato.email,
          assunto,
          corpo,
          cat.cc,
          spreadsheetId,
          cat.nomeRemetente
        );

        const hoje = new Date().toISOString().split('T')[0];

        if (result.success) {
          await writeSheet(
            'Contatos!H' + contato.rowIndex + ':K' + contato.rowIndex,
            [['OK ' + hoje, '', '', result.threadId || '']],
            spreadsheetId
          );
          totalEnviados++;
        } else {
          await writeSheet(
            'Contatos!H' + contato.rowIndex,
            [['ERRO ' + hoje + ': ' + result.error]],
            spreadsheetId
          );
          erros.push(contato.email + ': ' + result.error);
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  return { ok: true, enviados: totalEnviados, erros };
}

export async function GET(req: NextRequest) {
  const result = await runSendEmails();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runSendEmails(body.category);
    return NextResponse.json(result);
  } catch {
    const result = await runSendEmails();
    return NextResponse.json(result);
  }
}