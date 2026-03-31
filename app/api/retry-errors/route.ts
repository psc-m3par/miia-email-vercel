import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

async function runRetryErrors(category?: string) {
  const allIds = getAllSpreadsheetIds();
  let totalCorrigidos = 0;
  let erros: string[] = [];
  let totalErros = 0;

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

      const comErro = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        c.email1Enviado.startsWith('ERRO') &&
        c.email
      );

      totalErros += comErro.length;
      if (comErro.length === 0) continue;

      const lote = comErro;
      let corrigidosCat = 0;
      const errosCat: string[] = [];

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
          totalCorrigidos++;
          corrigidosCat++;
        } else {
          const errLower = (result.error || '').toLowerCase();
          const isPermanent = errLower.includes('invalid to') ||
            errLower.includes('invalid email') ||
            errLower.includes('does not exist') ||
            errLower.includes('not found') ||
            errLower.includes('address rejected') ||
            errLower.includes('mailbox unavailable') ||
            errLower.includes('no such user') ||
            errLower.includes('user unknown') ||
            errLower.includes('recipient rejected');
          // Se já estava em ERRO e falhou de novo, marca como BOUNCE (evita loop infinito)
          await writeSheet(
            'Contatos!H' + contato.rowIndex + ':K' + contato.rowIndex,
            [[isPermanent
              ? 'BOUNCE ' + hoje + ': ' + result.error
              : 'BOUNCE ' + hoje + ': falha persistente - ' + result.error,
              '', '', '']],
            spreadsheetId
          );
          errosCat.push(contato.email + ': ' + result.error);
          erros.push(contato.email + ': ' + result.error);
        }
      }

      await appendLog(
        'Email 1', cat.category, corrigidosCat,
        errosCat.length > 0 ? 'erro' : 'ok',
        corrigidosCat > 0 ? `${corrigidosCat} erro(s) corrigido(s)` : `Sem correções bem-sucedidas`,
        spreadsheetId
      );
    }
  }

  const restantes = totalErros - totalCorrigidos - erros.length;
  return { ok: true, corrigidos: totalCorrigidos, erros, restantes: restantes > 0 ? restantes : 0 };
}

export async function GET(req: NextRequest) {
  const result = await runRetryErrors();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runRetryErrors(body.category);
    return NextResponse.json(result);
  } catch {
    const result = await runRetryErrors();
    return NextResponse.json(result);
  }
}