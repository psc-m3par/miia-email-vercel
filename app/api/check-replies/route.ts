import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runCheckReplies() {
  const allIds = getAllSpreadsheetIds();
  let totalRespondidos = 0;

  for (const spreadsheetId of allIds) {
    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    for (const cat of painel) {
      if (!cat.ativo) continue;

      const enviados = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        c.email1Enviado.startsWith('OK') &&
        c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO') &&
        !c.fup2Enviado.includes('RESPONDIDO')
      );

      for (const contato of enviados) {
        const result = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);

        if (result.hasReply) {
          if (contato.fup1Enviado.startsWith('OK')) {
            await writeSheet(
              'Contatos!J' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          } else {
            await writeSheet(
              'Contatos!I' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          }
          totalRespondidos++;
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  return { ok: true, respondidos: totalRespondidos };
}

export async function GET(req: NextRequest) {
  const result = await runCheckReplies();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const result = await runCheckReplies();
  return NextResponse.json(result);
}