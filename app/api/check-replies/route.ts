import { NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_POR_RODADA = 20;

async function runCheckReplies() {
  const allIds = getAllSpreadsheetIds();
  let totalRespondidos = 0;
  let processados = 0;

  for (const spreadsheetId of allIds) {
    if (processados >= MAX_POR_RODADA) break;

    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    for (const cat of painel) {
      if (processados >= MAX_POR_RODADA) break;
      if (!cat.ativo) continue;

      const enviados = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        c.email1Enviado.startsWith('OK') &&
        c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO') &&
        !c.fup2Enviado.includes('RESPONDIDO')
      );

      for (const contato of enviados) {
        if (processados >= MAX_POR_RODADA) break;

        const result = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);

        if (result.hasReply) {
          // Marca RESPONDIDO em todas as colunas pendentes (I e J)
          // para bloquear qualquer follow-up futuro
          if (!contato.fup1Enviado) {
            // Respondeu após Email 1 — marca FUP1 e FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!I' + contato.rowIndex + ':J' + contato.rowIndex,
              [['RESPONDIDO', 'RESPONDIDO']],
              spreadsheetId
            );
          } else if (contato.fup1Enviado.startsWith('OK') && !contato.fup2Enviado) {
            // Respondeu após FUP1 — marca FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!J' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          } else if (contato.fup2Enviado.startsWith('OK')) {
            // Respondeu após FUP2 — marca FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!J' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          }
          totalRespondidos++;
        }

        processados++;
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  return { ok: true, respondidos: totalRespondidos };
}

export async function GET() {
  const result = await runCheckReplies();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runCheckReplies();
  return NextResponse.json(result);
}
