import { NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendReply } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_POR_RODADA = 15;

async function runSendFups() {
  const allIds = getAllSpreadsheetIds();
  let totalFups = 0;
  let processados = 0;

  for (const spreadsheetId of allIds) {
    if (processados >= MAX_POR_RODADA) break;

    const [painel, templates, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readTemplates(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    for (const cat of painel) {
      if (processados >= MAX_POR_RODADA) break;
      if (!cat.ativo) continue;

      const template = templates.find(t => t.category.normalize('NFC') === cat.category.normalize('NFC'));
      if (!template) continue;

      const hoje = new Date();

      const prontosFup1 = contacts.filter(c => {
        if (c.category.normalize('NFC') !== cat.category.normalize('NFC')) return false;
        if (!c.email1Enviado.startsWith('OK')) return false;
        if (c.fup1Enviado) return false;
        if (!c.threadId) return false;
        const dataEnvio = c.email1Enviado.replace('OK ', '');
        const diff = Math.floor((hoje.getTime() - new Date(dataEnvio).getTime()) / 60000); // TEST MODE: em minutos
        return diff >= 5; // TEST MODE: 5 minutos
      });

      for (const contato of prontosFup1) {
        if (processados >= MAX_POR_RODADA) break;

        const assunto = (template.fup1Assunto || template.assunto)
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const corpo = template.fup1Corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const result = await sendReply(
          cat.responsavel, contato.email, assunto, corpo,
          contato.threadId, contato.threadId,
          cat.cc, spreadsheetId, cat.nomeRemetente
        );

        const hojeStr = hoje.toISOString().split('T')[0];
        await writeSheet(
          'Contatos!I' + contato.rowIndex,
          [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
          spreadsheetId
        );
        if (result.success) totalFups++;
        processados++;
        await new Promise(r => setTimeout(r, 500));
      }

      const prontosFup2 = contacts.filter(c => {
        if (c.category.normalize('NFC') !== cat.category.normalize('NFC')) return false;
        if (!c.fup1Enviado.startsWith('OK')) return false;
        if (c.fup2Enviado) return false;
        if (!c.threadId) return false;
        if (c.fup1Enviado.includes('RESPONDIDO')) return false;
        const dataFup1 = c.fup1Enviado.replace('OK ', '');
        const diff = Math.floor((hoje.getTime() - new Date(dataFup1).getTime()) / 60000); // TEST MODE: em minutos
        return diff >= 5; // TEST MODE: 5 minutos
      });

      for (const contato of prontosFup2) {
        if (processados >= MAX_POR_RODADA) break;

        const assunto = (template.fup2Assunto || template.assunto)
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const corpo = template.fup2Corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente);

        const result = await sendReply(
          cat.responsavel, contato.email, assunto, corpo,
          contato.threadId, contato.threadId,
          cat.cc, spreadsheetId, cat.nomeRemetente
        );

        const hojeStr = hoje.toISOString().split('T')[0];
        await writeSheet(
          'Contatos!J' + contato.rowIndex,
          [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
          spreadsheetId
        );
        if (result.success) totalFups++;
        processados++;
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  return { ok: true, fups: totalFups };
}

export async function GET() {
  const result = await runSendFups();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runSendFups();
  return NextResponse.json(result);
}
