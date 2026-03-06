import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
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
          c.category === cat.category &&
          c.email1Enviado.startsWith('OK') &&
          c.threadId &&
          !c.fup1Enviado.includes('RESPONDIDO') &&
          !c.fup2Enviado.includes('RESPONDIDO')
        );

        for (const contato of enviados) {
          const result = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);

          if (result.hasReply) {
            const col = contato.fup1Enviado ? 'J' : 'I';
            await writeSheet(
              `Contatos!${col}${contato.rowIndex}`,
              [['RESPONDIDO']],
              spreadsheetId
            );
            totalRespondidos++;
          }

          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    return NextResponse.json({ ok: true, respondidos: totalRespondidos });
  } catch (error: any) {
    console.error('Check replies error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}